import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { createRoomingStore, type RoomingError } from "./rooming";
import * as schema from "./schema";
import { prepareAgencyRoomingTemplate } from "./services/imports/prepare-agency-rooming-template";
import {
  applyRoomAssignmentPlan,
  previewRoomAssignments,
} from "./services/rooming/room-plan-service";
import { createTripsStore } from "./trips";

const clients: ReturnType<typeof createClient>[] = [];
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

async function createFixture() {
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
  const now = new Date();
  const people = [
    {
      id: "alice",
      name: "Alice",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Alpine",
      gender: "F" as const,
    },
    {
      id: "ben",
      name: "Ben",
      email: "ben@example.com",
      firstName: "Ben",
      lastName: "Boreal",
      gender: "M" as const,
    },
    {
      id: "cara",
      name: "Cara",
      email: "cara@example.com",
      firstName: "Cara",
      lastName: "Cime",
      gender: "F" as const,
    },
  ];
  for (const person of people) {
    await database.insert(schema.users).values({
      id: person.id,
      name: person.name,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(schema.tripMemberships).values({
      id: `membership-${person.id}`,
      tripId: trip.id,
      userId: person.id,
      role: "traveler",
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender,
      genderConfirmed: true,
    });
  }
  await database.insert(schema.rooms).values([
    {
      id: "room-one",
      tripId: trip.id,
      name: "Chambre 1",
      capacity: 2,
      genderPolicy: "single_gender",
    },
    {
      id: "room-two",
      tripId: trip.id,
      name: "Chambre 2",
      capacity: 2,
      genderPolicy: "single_gender",
    },
  ]);
  await database.insert(schema.roomAssignments).values([
    {
      id: "assignment-ben",
      tripId: trip.id,
      roomId: "room-one",
      userId: "ben",
    },
    {
      id: "assignment-cara",
      tripId: trip.id,
      roomId: "room-two",
      userId: "cara",
    },
  ]);
  return { client, database, trip };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

it("uses prefilled genders for new placements and leaves missing genders unassigned", async () => {
  const { database, trip } = await createFixture();
  await database.update(schema.tripMemberships).set({ genderConfirmed: false });
  await database
    .update(schema.tripMemberships)
    .set({ gender: null })
    .where(eq(schema.tripMemberships.userId, "ben"));
  await database
    .delete(schema.roomAssignments)
    .where(eq(schema.roomAssignments.userId, "ben"));

  const plan = await previewRoomAssignments(database, trip.id);
  expect(plan.assignments).toEqual([
    expect.objectContaining({
      userId: "alice",
      roomId: "room-two",
      gender: "F",
    }),
  ]);
  expect(plan.missingGender).toBe(1);
  expect(
    await applyRoomAssignmentPlan(database, trip.id, plan.snapshot, "cara"),
  ).toMatchObject({
    status: "applied",
    assigned: 1,
    missingGender: 1,
  });
});

it("exports numbered rooms into matching agency slots without changing the plan", async () => {
  const { database, trip } = await createFixture();
  await database
    .update(schema.rooms)
    .set({ name: "10", capacity: 3 })
    .where(eq(schema.rooms.id, "room-one"));
  await database
    .update(schema.rooms)
    .set({ name: "2", capacity: 3 })
    .where(eq(schema.rooms.id, "room-two"));
  await database.insert(schema.travelerDetails).values([
    { tripId: trip.id, userId: "cara", activityProfile: "ski" },
    { tripId: trip.id, userId: "ben", activityProfile: "spa" },
  ]);
  await database
    .update(schema.tripMemberships)
    .set({ isVip: true })
    .where(eq(schema.tripMemberships.userId, "ben"));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("SKI TRAIN HOTEL");
  sheet.addRow([
    "Nbre de pax",
    "NOMS",
    "Prénoms",
    "Catégorie",
    "Typologie de chambre",
    "N° de chambre",
    "non skieur (pas de forfait)",
    "LIEU DEPART TRAIN",
    "Régimes spéciaux",
    "Allergènes",
    "Téléphone",
    "Commentaires",
    "Placement train Aller",
  ]);
  for (const [type, capacity, number] of [
    ["QUAD", 4, 1],
    ["TRIPLE", 3, 8],
    ["TRIPLE", 3, 9],
  ] as const) {
    for (let bed = 0; bed < capacity; bed++) {
      sheet.addRow([null, "ancien occupant", null, null, type, number]);
    }
  }
  sheet.getCell("F11").value = 8;
  sheet.getCell("M6").value = "12A";
  sheet.getCell("L6").value = "Note agence";
  const buffer = await workbook.xlsx.writeBuffer();
  const result = await prepareAgencyRoomingTemplate(
    database,
    trip.id,
    Uint8Array.from(new Uint8Array(buffer)).buffer,
  );
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) return;
  const output = new ExcelJS.Workbook();
  await output.xlsx.load(Uint8Array.from(result.workbook).buffer);
  const exported = output.getWorksheet("SKI TRAIN HOTEL");
  expect(exported?.getCell("B2").text).toBe("");
  expect(exported?.getCell("A6").value).toBe(1);
  expect(exported?.getCell("B6").text).toBe("Cime");
  expect(exported?.getCell("B9").text).toBe("Boreal");
  expect(exported?.getCell("D2").text).toBe("");
  expect(exported?.getCell("D6").text).toBe("adulte");
  expect(exported?.getCell("D9").text).toBe("adulte");
  expect(exported?.getCell("G6").text).toBe("skieur (forfait)");
  expect(exported?.getCell("G9").text).toBe("non skieur (pas de forfait)");
  expect(exported?.getCell("F6").value).toBe(8);
  expect(exported?.getCell("F11").value).toBe(9);
  expect(exported?.getCell("M6").text).toBe("12A");
  expect(exported?.getCell("L6").text).toBe("Note agence");
  expect(
    await database.select({ name: schema.rooms.name }).from(schema.rooms),
  ).toEqual([{ name: "10" }, { name: "2" }]);
});

describe("room change consent", () => {
  it("requires the mover and every occupant of a newly mixed room, then applies atomically", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    const request = await store.createRequest(trip.id, "cara", [
      { userId: "cara", expectedRoomId: "room-two", targetRoomId: "room-one" },
    ]);

    expect(request.status).toBe("pending");
    expect(request.requiredConsents).toEqual(["ben", "cara"]);
    await expect(
      store.consent(trip.id, request.id, "alice", true),
    ).rejects.toMatchObject({
      code: "consent_not_required",
    } satisfies Partial<RoomingError>);

    const result = await store.consent(trip.id, request.id, "ben", true);
    expect(result).toEqual({ status: "applied" });
    const assignments = await database
      .select()
      .from(schema.roomAssignments)
      .orderBy(schema.roomAssignments.userId);
    expect(
      assignments.map(({ userId, roomId }) => ({ userId, roomId })),
    ).toEqual([
      { userId: "ben", roomId: "room-one" },
      { userId: "cara", roomId: "room-one" },
    ]);
    const [room] = await database
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.id, "room-one"));
    expect(room?.genderPolicy).toBe("mixed");
  });

  it("rejects a proposal that would exceed capacity without moving anyone", async () => {
    const { database, trip } = await createFixture();
    await database.insert(schema.roomAssignments).values({
      id: "assignment-alice",
      tripId: trip.id,
      roomId: "room-one",
      userId: "alice",
    });
    await expect(
      createRoomingStore(database).createRequest(trip.id, "cara", [
        {
          userId: "cara",
          expectedRoomId: "room-two",
          targetRoomId: "room-one",
        },
      ]),
    ).rejects.toMatchObject({ code: "room_capacity_exceeded" });
    const assignments = await database.select().from(schema.roomAssignments);
    expect(assignments).toHaveLength(3);
    expect(
      await database.select().from(schema.roomChangeRequests),
    ).toHaveLength(0);
  });

  it("marks a proposal stale when a room composition changes before the final consent", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    const request = await store.createRequest(trip.id, "cara", [
      { userId: "cara", expectedRoomId: "room-two", targetRoomId: "room-one" },
    ]);
    await database
      .update(schema.rooms)
      .set({ compositionVersion: 2 })
      .where(eq(schema.rooms.id, "room-one"));

    const result = await store.consent(trip.id, request.id, "ben", true);
    expect(result).toEqual({ status: "stale" });
    const [persisted] = await database.select().from(schema.roomChangeRequests);
    expect(persisted?.status).toBe("stale");
  });

  it("does not block a valid request because an unrelated room is over capacity", async () => {
    const { database, trip } = await createFixture();
    await database.insert(schema.rooms).values({
      id: "room-overfull",
      tripId: trip.id,
      name: "Chambre déjà en anomalie",
      capacity: 1,
      genderPolicy: "single_gender",
    });
    const now = new Date();
    await database.insert(schema.users).values({
      id: "diana",
      name: "Diana",
      email: "diana@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(schema.tripMemberships).values({
      id: "membership-diana",
      tripId: trip.id,
      userId: "diana",
      role: "traveler",
      firstName: "Diana",
      lastName: "Dune",
      gender: "F",
    });
    await database.insert(schema.roomAssignments).values([
      {
        id: "assignment-overfull-alice",
        tripId: trip.id,
        roomId: "room-overfull",
        userId: "alice",
      },
      {
        id: "assignment-overfull-diana",
        tripId: trip.id,
        roomId: "room-overfull",
        userId: "diana",
      },
    ]);

    await expect(
      createRoomingStore(database).createRequest(trip.id, "cara", [
        {
          userId: "cara",
          expectedRoomId: "room-two",
          targetRoomId: "room-one",
        },
      ]),
    ).resolves.toMatchObject({ status: "pending" });
  });
});
