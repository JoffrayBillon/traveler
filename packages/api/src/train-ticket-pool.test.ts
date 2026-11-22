import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it, vi } from "vitest";
import { createApp } from "./app";
import { createAuth, createMagicLinkCapture } from "./auth";
import { createManagersStore } from "./managers";
import * as schema from "./schema";
import type { ValidatedRosterRow } from "./source-import/types";
import { importValidatedRoster } from "./source-imports/validated-roster-import";

const origin = "http://127.0.0.1:5173";
const authentication = {
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: "local-test-secret-for-train-ticket-pool",
  CRON_SECRET: "train-pool-integration-test-secret",
};

it("publishes group seats and transfers a cancelled traveler's seat to a compatible roommate", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const database = drizzle({ client, schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
    const tripId = "train-pool-trip";
    await database
      .insert(schema.trips)
      .values({ id: tripId, name: "Train pool trip" });
    const manager = await createManagersStore(database).create({
      tripId,
      email: "manager@example.test",
      firstName: "Test",
      lastName: "Manager",
    });
    await database.insert(schema.transportGroups).values([
      {
        tripId,
        id: "ski-paris",
        name: "Paris",
        sourceCity: "Paris",
        normalizedCity: "paris",
      },
      {
        tripId,
        id: "ski-lyon",
        name: "Lyon",
        sourceCity: "Lyon",
        normalizedCity: "lyon",
      },
    ]);
    await database.insert(schema.transportGroupSegments).values({
      id: "paris-outbound",
      tripId,
      groupId: "ski-paris",
      mode: "train",
      direction: "outbound",
      position: 0,
      origin: "Paris",
      destination: "Lyon",
    });
    await database
      .insert(schema.rooms)
      .values({ tripId, id: "room-1", name: "01", capacity: 3 });

    function rosterRow(firstName: string): ValidatedRosterRow {
      return {
        row: 2,
        reference: firstName.toLowerCase(),
        firstName,
        lastName: "Traveler",
        email: `${firstName.toLowerCase()}@example.test`,
        gender: null,
        activityProfile: "ski",
        paymentStatus: "paid",
        amountPaidMinor: 100,
        amountDueMinor: 0,
      };
    }
    const alex = rosterRow("Alex");
    const bea = rosterRow("Bea");
    const chris = rosterRow("Chris");
    await importValidatedRoster(database, tripId, [alex, bea]);
    async function userFor(email: string) {
      const [user] = await database
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email));
      if (!user) throw new Error("Missing test traveler");
      return user.id;
    }

    const links = new Map<string, string>();
    const backgroundTasks: Promise<unknown>[] = [];
    const services = {
      client,
      database,
      auth: createAuth(database, authentication, async (email, url) => {
        links.set(email, url);
      }),
      scheduleBackgroundTask: (task: Promise<unknown>) => {
        backgroundTasks.push(task);
      },
      magicLinkCapture: createMagicLinkCapture(),
    };
    const put = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn(async () => ({
      statusCode: 200,
      stream: new Blob(["%PDF-1.7"]).stream(),
    }));
    const app = createApp(
      () => client,
      () => services,
      {
        authEnvironment: authentication,
        ticketStorage: { put, get, del },
        ticketStorageAvailable: () => true,
      },
    );
    async function signIn(email: string) {
      await app.request("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({ email, callbackURL: "/" }),
      });
      await Promise.all(backgroundTasks.splice(0));
      const link = links.get(email);
      if (!link) throw new Error("Missing sign-in link");
      const response = await app.request(link, {
        method: "POST",
        headers: { Origin: origin },
        body: new URL(link).searchParams,
      });
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("Missing test session");
      return cookie;
    }
    const managerCookie = await signIn(manager.email);
    const alexCookie = await signIn(alex.email);
    const base = `/api/trips/${tripId}`;
    const pool = `${base}/train-tickets/paris-outbound`;
    const managerHeaders = {
      Cookie: managerCookie,
      "Content-Type": "application/json",
    };
    async function move(userId: string) {
      const response = await app.request(
        `${base}/rooms/room-1/participants/${userId}`,
        {
          method: "PUT",
          headers: managerHeaders,
          body: JSON.stringify({ expectedRoomId: null }),
        },
      );
      expect(response.status).toBe(200);
    }
    async function setTransport(userId: string, groupId: string) {
      const response = await app.request(
        `${base}/participants/${userId}/transport`,
        {
          method: "PUT",
          headers: managerHeaders,
          body: JSON.stringify({ choice: "group", groupId }),
        },
      );
      expect(response.status).toBe(200);
    }
    const alexId = await userFor(alex.email);
    const beaId = await userFor(bea.email);
    await setTransport(alexId, "ski-paris");
    await setTransport(beaId, "ski-paris");
    await move(alexId);
    await move(beaId);

    const form = new FormData();
    form.set(
      "file",
      new File(["%PDF-1.7"], "group.pdf", { type: "application/pdf" }),
    );
    form.set("seats", "Voiture 4, place 12\nVoiture 4, place 13");
    const upload = await app.request(`${pool}/documents`, {
      method: "POST",
      headers: { Cookie: managerCookie },
      body: form,
    });
    expect(upload.status).toBe(201);
    const { documentId } = (await upload.json()) as { documentId: string };
    const ticketPath = `${base}/tickets/${documentId}`;
    expect(
      (await app.request(ticketPath, { headers: { Cookie: alexCookie } }))
        .status,
    ).toBe(404);
    const preview = await app.request(pool, {
      headers: { Cookie: managerCookie },
    });
    const { snapshot } = (await preview.json()) as { snapshot: string };
    expect(
      (
        await app.request(`${pool}/publish`, {
          method: "POST",
          headers: managerHeaders,
          body: JSON.stringify({ snapshot }),
        })
      ).status,
    ).toBe(200);
    expect(
      (await app.request(ticketPath, { headers: { Cookie: alexCookie } }))
        .status,
    ).toBe(200);

    await importValidatedRoster(database, tripId, [bea, chris]);
    const chrisId = await userFor(chris.email);
    await setTransport(chrisId, "ski-lyon");
    await move(chrisId);
    const chrisCookie = await signIn(chris.email);
    expect(
      (await app.request(ticketPath, { headers: { Cookie: chrisCookie } }))
        .status,
    ).toBe(404);
    expect(
      (await app.request(ticketPath, { headers: { Cookie: alexCookie } }))
        .status,
    ).toBe(404);
    await setTransport(chrisId, "ski-paris");
    expect(
      await database
        .select()
        .from(schema.trainTicketSeats)
        .orderBy(schema.trainTicketSeats.position),
    ).toMatchObject([
      { label: "Voiture 4, place 12", userId: chrisId },
      { label: "Voiture 4, place 13", userId: beaId },
    ]);
    const traveler = await app.request(`${base}/traveler`, {
      headers: { Cookie: chrisCookie },
    });
    expect(await traveler.json()).toMatchObject({
      tickets: [{ id: documentId, seatLabel: "Voiture 4, place 12" }],
    });
    expect(
      (await app.request(ticketPath, { headers: { Cookie: chrisCookie } }))
        .status,
    ).toBe(200);
    expect(put).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
    await database
      .update(schema.trips)
      .set({ endsOn: "2020-01-01" })
      .where(eq(schema.trips.id, tripId));
    const purge = await app.request("/api/cron/purge-expired-trips", {
      headers: { Authorization: `Bearer ${authentication.CRON_SECRET}` },
    });
    expect(await purge.json()).toEqual({
      purgedTrips: 1,
      deleted: 1,
      failed: 0,
    });
    expect(await database.select().from(schema.trainTicketSeats)).toEqual([]);
    expect(del).toHaveBeenCalledTimes(1);
  } finally {
    await client.close();
  }
});
