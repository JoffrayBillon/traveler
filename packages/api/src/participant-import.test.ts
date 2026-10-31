import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseParticipantWorkbook,
  participantImportHeaders,
} from "./participant-import";
import { importParticipants } from "./participants";
import * as schema from "./schema";
import { createTripsStore } from "./trips";

const clients: ReturnType<typeof createClient>[] = [];
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

async function workbookBuffer(rows: string[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Participants");
  sheet.addRow([...participantImportHeaders]);
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer).buffer;
}

function validRow(overrides: Record<string, string> = {}) {
  const values: Record<(typeof participantImportHeaders)[number], string> = {
    Nom: "Voyageur",
    Prenom: "Alex",
    Email: "alex@example.com",
    Genre: "F",
    ProfilActivite: "skier",
    OptionSkiJ3: "Oui",
    TypeTransport: "train",
    VilleDepart: "Paris",
    Aller_Ref: "TGV1234",
    Aller_HeureRDV: "07:00",
    Aller_HeureDepart: "08:00",
    Aller_Siege: "12A",
    Retour_Ref: "TGV4321",
    Retour_HeureRDV: "17:00",
    Retour_HeureDepart: "18:00",
    Retour_Siege: "12A",
    ChambreInitiale: "",
  };
  Object.assign(values, overrides);
  return participantImportHeaders.map((header) => values[header]);
}

async function createDatabase() {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  const database = drizzle({ client, schema });
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const migration = await readFile(join(migrationsDirectory, file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.execute(statement);
    }
  }
  const trip = await createTripsStore(database).create("Ski 2027");
  return { database, trip };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("participant spreadsheet import", () => {
  it("normalizes imported values and reports invalid rows before writing", async () => {
    const parsed = await parseParticipantWorkbook(
      await workbookBuffer([
        validRow({ Email: "  ALEX@EXAMPLE.COM  ", Aller_HeureRDV: "7:05" }),
        validRow({
          Email: "alex@example.com",
          ProfilActivite: "spa",
          OptionSkiJ3: "Oui",
        }),
      ]),
    );
    expect(parsed.participants).toHaveLength(0);
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          field: "Email",
          message: expect.stringContaining("en double"),
        }),
        expect.objectContaining({ row: 3, field: "OptionSkiJ3" }),
      ]),
    );
  });

  it("upserts membership data while preserving staff tickets, locations and room assignment", async () => {
    const { database, trip } = await createDatabase();
    const now = new Date();
    await database.insert(schema.rooms).values({
      id: "room-1",
      tripId: trip.id,
      name: "Chambre 101",
      capacity: 4,
    });
    await database.insert(schema.users).values({
      id: "staff-user",
      name: "Mina Manager",
      email: "manager@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    const first = await parseParticipantWorkbook(
      await workbookBuffer([validRow({ ChambreInitiale: "Chambre 101" })]),
    );
    expect(first.errors).toEqual([]);
    const firstResult = await importParticipants(
      database,
      trip.id,
      first.participants,
    );
    expect(firstResult).toMatchObject({
      created: 1,
      updated: 0,
      assigned: 1,
      errors: [],
    });

    const [participant] = await database
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "alex@example.com"));
    expect(participant).toBeDefined();
    await database
      .update(schema.travelerDetails)
      .set({ outboundLocation: "Paris Gare de Lyon" })
      .where(eq(schema.travelerDetails.userId, participant?.id ?? ""));
    await database.insert(schema.transportTickets).values({
      id: "ticket-1",
      tripId: trip.id,
      userId: participant?.id ?? "",
      kind: "outbound",
      blobPath: "trip/ticket",
      originalName: "billet.pdf",
      contentType: "application/pdf",
      size: 100,
      uploadedBy: "staff-user",
    });

    const second = await parseParticipantWorkbook(
      await workbookBuffer([
        validRow({
          Prenom: "Alexandre",
          Email: " ALEX@example.com ",
          Aller_Ref: "TGV9999",
          ChambreInitiale: "",
        }),
      ]),
    );
    expect(second.errors).toEqual([]);
    const secondResult = await importParticipants(
      database,
      trip.id,
      second.participants,
    );
    expect(secondResult).toMatchObject({
      created: 0,
      updated: 1,
      assigned: 0,
      errors: [],
    });
    const [membership] = await database
      .select()
      .from(schema.tripMemberships)
      .where(eq(schema.tripMemberships.userId, participant?.id ?? ""));
    const [details] = await database
      .select()
      .from(schema.travelerDetails)
      .where(eq(schema.travelerDetails.userId, participant?.id ?? ""));
    expect(membership?.firstName).toBe("Alexandre");
    expect(details?.outboundReference).toBe("TGV9999");
    expect(details?.outboundLocation).toBe("Paris Gare de Lyon");
    expect(await database.select().from(schema.transportTickets)).toHaveLength(
      1,
    );
    expect(await database.select().from(schema.roomAssignments)).toHaveLength(
      1,
    );
  });
});
