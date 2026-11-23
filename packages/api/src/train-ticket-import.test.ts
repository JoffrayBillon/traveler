import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import { readTicketPdf } from "./adapters/pdf/ticket-pdf.adapter";
import { createApp } from "./app";
import { createAuth, createMagicLinkCapture } from "./auth";
import { createManagersStore } from "./managers";
import type { TicketBlobStorage } from "./ports/ticket-storage";
import * as schema from "./schema";
import type { getTrainTicketImport } from "./services/tickets/train-ticket-import";
import { reconcileTrainTicketSeats } from "./services/tickets/train-ticket-pool";

const origin = "http://127.0.0.1:5173";
const environment = {
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: "local-test-secret-for-imported-train-tickets",
  CRON_SECRET: "imported-train-tickets-test",
};
type Review = Awaited<ReturnType<typeof getTrainTicketImport>>;

it("reviews mixed rail PDFs, publishes isolated tickets and withholds collective files", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const database = drizzle({ client, schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
    const tripId = "train-import";
    await database
      .insert(schema.trips)
      .values({ id: tripId, name: "Synthetic trip" });
    const managers = createManagersStore(database);
    const manager = await managers.create({
      tripId,
      email: "rail-staff@example.test",
      firstName: "Staff",
      lastName: "Test",
    });
    const travelers = [];
    for (const firstName of ["Alex", "Bea", "Chris"]) {
      const person = await managers.create({
        tripId,
        email: `${firstName.toLowerCase()}@example.test`,
        firstName,
        lastName: "Tester",
      });
      await database
        .update(schema.tripMemberships)
        .set({ role: "traveler" })
        .where(eq(schema.tripMemberships.userId, person.userId));
      travelers.push(person);
    }
    const groupId = "rail-group";
    await database.insert(schema.transportGroups).values({
      id: groupId,
      tripId,
      name: "Rail",
      sourceCity: "Paris",
      normalizedCity: "paris",
    });
    await database.insert(schema.transportGroupSegments).values([
      {
        id: "outbound",
        tripId,
        groupId,
        direction: "outbound",
        mode: "train",
        position: 0,
        origin: "Paris",
        destination: "Lyon",
      },
      {
        id: "return",
        tripId,
        groupId,
        direction: "return",
        mode: "train",
        position: 1,
        origin: "Lyon",
        destination: "Paris",
      },
    ]);
    await database
      .insert(schema.rooms)
      .values({ id: "rail-room", tripId, name: "1", capacity: 3 });
    await database.insert(schema.roomAssignments).values(
      travelers.map(({ userId }) => ({
        id: `room-${userId}`,
        tripId,
        userId,
        roomId: "rail-room",
      })),
    );
    await database
      .insert(schema.transportGroupAssignments)
      .values(travelers.map(({ userId }) => ({ tripId, userId, groupId })));

    const links = new Map<string, string>();
    const background: Promise<unknown>[] = [];
    const services = {
      client,
      database,
      auth: createAuth(database, environment, async (email, url) => {
        links.set(email, url);
      }),
      scheduleBackgroundTask: (task: Promise<unknown>) => {
        background.push(task);
      },
      magicLinkCapture: createMagicLinkCapture(),
    };
    const blobs = new Map<string, Blob>();
    const storage: TicketBlobStorage = {
      put: async (path, file) => blobs.set(path, file),
      get: async (path) => {
        const file = blobs.get(path);
        return file ? { statusCode: 200, stream: file.stream() } : null;
      },
      del: async (path) => {
        blobs.delete(path);
      },
    };
    const app = createApp(
      () => client,
      () => services,
      {
        authEnvironment: environment,
        ticketStorage: storage,
        ticketStorageAvailable: () => true,
      },
    );
    async function signIn(email: string) {
      await app.request("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({ email, callbackURL: "/" }),
      });
      await Promise.all(background.splice(0));
      const link = links.get(email);
      if (!link) throw new Error("Missing test link");
      const response = await app.request(link, {
        method: "POST",
        headers: { Origin: origin },
        body: new URL(link).searchParams,
      });
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("Missing test session");
      return { Cookie: cookie };
    }
    const [alex, bea, chris] = travelers;
    if (!alex || !bea || !chris) throw new Error("Missing test travelers");
    const staff = await signIn(manager.email);
    const alexHeaders = await signIn(alex.email);
    const beaHeaders = await signIn(bea.email);
    const chrisHeaders = await signIn(chris.email);
    const trip = `/api/trips/${tripId}`;
    const imports = `${trip}/train-tickets/outbound/imports`;
    const getReview = async () => {
      const response = await app.request(imports, { headers: staff });
      expect(response.status).toBe(200);
      return (await response.json()) as Review;
    };
    const jsonStaff = { ...staff, "Content-Type": "application/json" };
    const publish = (snapshot: string) =>
      app.request(`${imports}/publish`, {
        method: "POST",
        headers: jsonStaff,
        body: JSON.stringify({ snapshot }),
      });
    const upload = (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return app.request(`${imports}/documents`, {
        method: "POST",
        headers: staff,
        body,
      });
    };
    expect((await app.request(imports, { headers: alexHeaders })).status).toBe(
      404,
    );
    expect(
      (
        await app.request(imports.replace(tripId, "another-trip"), {
          headers: staff,
        })
      ).status,
    ).toBe(404);
    const mixed = await pdfFile([
      [
        "TGV INOUI",
        "N° E-BILLET : 123450001",
        "TARIF GROUPE ADULTES",
        "Nom : TESTER",
        "Prénom : BEA",
        "VOITURE 1 - PLACE 41",
      ],
      [
        "TGV INOUI",
        "N° E-BILLET : 123450002",
        "Nom : TESTER",
        "Prénom : BEA",
        "VOITURE 1 - PLACE 42",
      ],
    ]);
    const result = await upload(mixed);
    expect(result.status).toBe(201);
    const { documentId } = (await result.json()) as { documentId: string };
    expect((await upload(mixed)).status).toBe(200);
    expect(blobs.size).toBe(1);
    const firstReview = await getReview();
    expect(firstReview.coverage).toMatchObject({
      expected: 3,
      ready: 2,
      published: 0,
      missing: [{ id: chris.userId }],
    });
    expect(firstReview.documents[0]?.items).toMatchObject([
      { kind: "transferable", firstName: null, userIds: [alex.userId] },
      { kind: "named", userIds: [bea.userId] },
    ]);
    const groupItem = firstReview.documents[0]?.items[0];
    if (!groupItem) throw new Error("Missing test group ticket");
    expect(
      (
        await app.request(`${imports}/items/${groupItem.id}/pdf`, {
          headers: alexHeaders,
        })
      ).status,
    ).toBe(404);
    expect(
      (await app.request(`${trip}/tickets/${documentId}`, { headers: staff }))
        .status,
    ).toBe(404);
    const source = `${imports}/documents/${documentId}/pdf`;
    expect((await app.request(source, { headers: beaHeaders })).status).toBe(
      404,
    );
    expect((await app.request(source, { headers: staff })).status).toBe(200);

    const collective = await pdfFile([
      ["TRENITALIA", "BIGLIETTO DI GRUPPO", "1 ADULTO"],
    ]);
    expect((await upload(collective)).status).toBe(201);
    expect((await publish(firstReview.snapshot)).status).toBe(409);
    const draft = await getReview();
    const collectiveItem = draft.documents
      .flatMap(({ items }) => items)
      .find(({ carrier }) => carrier === "trenitalia");
    if (!collectiveItem) throw new Error("Missing test collective");
    expect(
      (
        await app.request(`${imports}/items/${collectiveItem.id}`, {
          method: "PATCH",
          headers: jsonStaff,
          body: JSON.stringify({
            kind: "collective",
            capacity: 1,
            userIds: [chris.userId],
          }),
        })
      ).status,
    ).toBe(200);
    const ready = await getReview();
    expect(ready.coverage).toEqual({
      expected: 3,
      ready: 3,
      published: 0,
      missing: [],
    });
    expect((await publish(ready.snapshot)).status).toBe(200);
    expect((await getReview()).coverage.published).toBe(3);
    const returned = await app.request(imports.replace("outbound", "return"), {
      headers: staff,
    });
    expect(await returned.json()).toMatchObject({
      documents: [],
      coverage: { expected: 3, published: 0 },
    });

    const personal = await app.request(`${trip}/traveler`, {
      headers: alexHeaders,
    });
    const {
      tickets: [alexTicket],
    } = (await personal.json()) as { tickets: Array<{ id: string }> };
    if (!alexTicket) throw new Error("Missing published ticket");
    const ticketPath = `${trip}/tickets/${alexTicket.id}`;
    expect(
      (await app.request(ticketPath, { headers: beaHeaders })).status,
    ).toBe(404);
    const download = await app.request(ticketPath, { headers: alexHeaders });
    expect(download.status).toBe(200);
    const pages = await readTicketPdf(
      new Uint8Array(await download.arrayBuffer()),
    );
    expect(pages).toHaveLength(1);
    const ticketText = pages
      .flatMap(({ textBlocks }) => textBlocks.map(({ text }) => text))
      .join(" ");
    expect(ticketText).toContain("123450001");
    expect(ticketText).not.toContain("123450002");
    const chrisProfile = await app.request(`${trip}/traveler`, {
      headers: chrisHeaders,
    });
    const {
      tickets: [chrisTicket],
    } = (await chrisProfile.json()) as {
      tickets: Array<{ id: string; managedByStaff: boolean }>;
    };
    expect(chrisTicket?.managedByStaff).toBe(true);
    expect(
      (
        await app.request(`${trip}/tickets/${chrisTicket?.id}`, {
          headers: chrisHeaders,
        })
      ).status,
    ).toBe(404);

    const withdrawal = await app.request(`${imports}/documents/${documentId}`, {
      method: "DELETE",
      headers: staff,
    });
    expect(withdrawal.status).toBe(409);
    expect(
      (await app.request(ticketPath, { headers: alexHeaders })).status,
    ).toBe(200);

    const replacement = await managers.create({
      tripId,
      email: "replacement@example.test",
      firstName: "Replacement",
      lastName: "Tester",
    });
    await database.transaction(async (transaction) => {
      await transaction
        .delete(schema.transportGroupAssignments)
        .where(
          inArray(schema.transportGroupAssignments.userId, [
            alex.userId,
            bea.userId,
          ]),
        );
      await transaction.insert(schema.transportGroupAssignments).values({
        tripId,
        groupId,
        userId: replacement.userId,
      });
      await transaction.insert(schema.roomAssignments).values({
        id: "replacement-room-assignment",
        tripId,
        roomId: "rail-room",
        userId: replacement.userId,
      });
      await reconcileTrainTicketSeats(transaction, tripId);
    });
    const repairedSeats = await database.select().from(schema.trainTicketSeats);
    expect(
      repairedSeats.find(({ allocation }) => allocation === "pool")?.userId,
    ).toBe(replacement.userId);
    expect(repairedSeats.some(({ allocation }) => allocation === "named")).toBe(
      false,
    );
    expect(
      (await app.request(ticketPath, { headers: alexHeaders })).status,
    ).toBe(404);

    await database
      .update(schema.trips)
      .set({ endsOn: "2020-01-01" })
      .where(eq(schema.trips.id, tripId));
    const purge = await app.request("/api/cron/purge-expired-trips", {
      headers: { Authorization: `Bearer ${environment.CRON_SECRET}` },
    });
    expect(await purge.json()).toEqual({
      purgedTrips: 1,
      deleted: 2,
      failed: 0,
    });
    expect(blobs.size).toBe(0);
  } finally {
    client.close();
  }
});

async function pdfFile(contents: string[][]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const lines of contents) {
    const page = document.addPage();
    page.drawText(lines.join("\n"), {
      x: 40,
      y: 750,
      size: 12,
      lineHeight: 20,
      font,
    });
  }
  return new File([new Uint8Array(await document.save())], "synthetic.pdf", {
    type: "application/pdf",
  });
}
