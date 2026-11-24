import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { listAgencyRoomingMembers } from "./datamodel/agency-rooming.repository";
import { getRoomingView } from "./datamodel/rooming.repository";
import { listTripTravelerRows } from "./datamodel/staff-directory.repository";
import { createRoomingStore, type RoomingError } from "./rooming";
import * as schema from "./schema";
import { prepareAgencyRoomingTemplate } from "./services/imports/prepare-agency-rooming-template";
import { saveParticipantFromOrganizer } from "./services/participant-editor-service";
import { staffMoveTraveler } from "./services/rooming/room-management-service";
import {
  applyRoomAssignmentPlan,
  previewRoomAssignments,
} from "./services/rooming/room-plan-service";
import { completeTravelerProfile } from "./services/traveler-details";
import { importValidatedRoster } from "./source-imports/validated-roster-import";
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

it("shows prefilled room composition to organizers and redacts it from traveler views", async () => {
  const { database, trip } = await createFixture();
  await database.update(schema.tripMemberships).set({ genderConfirmed: false });
  await database
    .update(schema.tripMemberships)
    .set({ role: "companion" })
    .where(eq(schema.tripMemberships.userId, "alice"));
  const readRooms = async (userId: string, organizerView: boolean) =>
    (await getRoomingView(database, trip.id, userId, organizerView))?.rooms ??
    [];
  expect(
    (await readRooms("alice", true)).map((room) => room.composition),
  ).toEqual(["male", "female"]);

  await database
    .update(schema.roomAssignments)
    .set({ roomId: "room-one" })
    .where(eq(schema.roomAssignments.userId, "cara"));
  const staffRooms = await readRooms("alice", true);
  expect(staffRooms.map((room) => room.composition)).toEqual([
    "mixed",
    "unset",
  ]);
  for (const rooms of [
    await readRooms("alice", false),
    await readRooms("ben", true),
  ]) {
    expect(rooms[0]?.occupants).toHaveLength(2);
    for (const room of rooms) {
      expect(room).not.toHaveProperty("composition");
      expect(room).not.toHaveProperty("genderPolicy");
      for (const person of room.occupants)
        expect(person).not.toHaveProperty("gender");
    }
  }
});

it("keeps locked rooms out of the personal exchange plan and available to organizers", async () => {
  const { database, trip } = await createFixture();
  await database
    .update(schema.tripMemberships)
    .set({ role: "companion" })
    .where(eq(schema.tripMemberships.userId, "cara"));
  await database
    .update(schema.rooms)
    .set({ capacity: 1, isLocked: true })
    .where(eq(schema.rooms.id, "room-one"));

  async function visibleRoomIds(userId: string, organizerView = false) {
    const view = await getRoomingView(database, trip.id, userId, organizerView);
    expect(view).not.toBeNull();
    return view?.rooms.map((room) => room.id);
  }

  expect(await visibleRoomIds("cara")).toEqual(["room-two"]);
  expect(await visibleRoomIds("cara", true)).toEqual(["room-one", "room-two"]);
  expect(await visibleRoomIds("alice", true)).toEqual(["room-two"]);
  expect(await visibleRoomIds("ben")).toEqual(["room-one"]);
  expect(
    (await getRoomingView(database, trip.id, "ben"))?.rooms[0],
  ).toMatchObject({
    isLocked: true,
    occupants: [expect.objectContaining({ userId: "ben" })],
  });

  await database
    .update(schema.rooms)
    .set({ isLocked: false })
    .where(eq(schema.rooms.id, "room-one"));
  expect(await visibleRoomIds("cara")).toEqual(["room-one", "room-two"]);
});

it("reads imported phone numbers and preserves manual updates and clearings", async () => {
  const { database, trip } = await createFixture();
  await database
    .update(schema.tripMemberships)
    .set({ role: "manager" })
    .where(eq(schema.tripMemberships.userId, "alice"));
  await database.insert(schema.tripRegistrations).values([
    {
      id: "ben-registration",
      tripId: trip.id,
      reference: "book-ben",
      userId: "ben",
      status: "validated",
      sourceEmail: "ben@example.com",
      firstName: "Ben",
      lastName: "Boreal",
      sourcePhone: "06 12 34 56 78",
    },
    {
      id: "cara-cancelled",
      tripId: trip.id,
      reference: "book-cara",
      userId: "cara",
      status: "cancelled",
      sourceEmail: "cara@example.com",
      firstName: "Cara",
      lastName: "Cime",
      sourcePhone: "+33612345679",
    },
  ]);
  const readPhone = async (userId: string) =>
    (await listTripTravelerRows(database, trip.id)).find(
      (row) => row.userId === userId,
    )?.personalPhone;
  expect(await readPhone("ben")).toBe("06 12 34 56 78");
  expect(await readPhone("cara")).toBeNull();
  const profile = {
    firstName: "Ben",
    lastName: "Boreal",
    gender: "M",
    emergencyContactFirstName: "Mina",
    emergencyContactLastName: "Boreal",
    emergencyContactPhone: "+33623456789",
  };
  expect(
    await completeTravelerProfile(database, trip.id, "ben", {
      ...profile,
      personalPhone: "invalid",
    }),
  ).toMatchObject({ ok: false });
  expect(
    await completeTravelerProfile(database, trip.id, "ben", {
      ...profile,
      personalPhone: "06 45 67 89 01",
    }),
  ).toMatchObject({ ok: true });
  await database
    .update(schema.tripRegistrations)
    .set({ sourcePhone: "+33634567890" })
    .where(eq(schema.tripRegistrations.id, "ben-registration"));
  expect(
    await completeTravelerProfile(database, trip.id, "ben", profile),
  ).toMatchObject({ ok: true });
  expect(await readPhone("ben")).toBe("+33645678901");
  expect(await listAgencyRoomingMembers(database, trip.id)).toContainEqual(
    expect.objectContaining({ userId: "ben", personalPhone: "+33645678901" }),
  );
  expect(
    await saveParticipantFromOrganizer(database, trip.id, "ben", "alice", {
      email: "ben@example.com",
      role: "traveler",
      profile: { ...profile, personalPhone: "" },
      details: {
        activityProfile: null,
        skiDayThree: false,
        transportChoice: "unconfirmed",
        groupId: null,
        carpoolRole: "none",
        carpoolDriverUserId: null,
      },
    }),
  ).toEqual({ status: "saved" });
  expect(await readPhone("ben")).toBe("");
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
  sheet.addRow([null, "Informations agence", "Ski 2027"]);
  type WorksheetWithValidations = ExcelJS.WorksheetModel & {
    dataValidations: Record<string, ExcelJS.DataValidation>;
  };
  const categoryRange = "D1:D1048576";
  const categoryValidation: ExcelJS.DataValidation = {
    type: "list",
    formulae: ['"adulte,enfant 5/11 ans,enfant -5 ans"'],
  };
  (sheet.model as WorksheetWithValidations).dataValidations[categoryRange] =
    categoryValidation;
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
  expect(
    (exported?.model as WorksheetWithValidations | undefined)?.dataValidations,
  ).toEqual({
    [categoryRange]: categoryValidation,
  });
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
  expect(exported?.getCell("B12").text).toBe("Informations agence");

  for (const invalidType of ["INCONNU", null]) {
    sheet.addRow([null, "Ancien occupant", "À retirer", null, invalidType, 99]);
    const invalidWorkbook = await workbook.xlsx.writeBuffer();
    expect(
      await prepareAgencyRoomingTemplate(
        database,
        trip.id,
        Uint8Array.from(new Uint8Array(invalidWorkbook)).buffer,
      ),
    ).toEqual({
      ok: false,
      status: 422,
      error: "agency_room_capacity_mismatch",
    });
    sheet.spliceRows(sheet.rowCount, 1);
  }
  expect(
    await database.select({ name: schema.rooms.name }).from(schema.rooms),
  ).toEqual([{ name: "10" }, { name: "2" }]);
});

describe("room change consent", () => {
  it("lets an unassigned traveler take a free place in a compatible room", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    await expect(
      store.createRequest(trip.id, "alice", [
        { userId: "alice", expectedRoomId: null, targetRoomId: "room-two" },
      ]),
    ).resolves.toMatchObject({
      status: "applied",
      requiredConsents: ["alice"],
    });
    const view = await getRoomingView(database, trip.id, "alice");
    expect(view?.rooms.find(({ id }) => id === "room-two")?.occupiedCount).toBe(
      2,
    );
  });

  it("requires every occupant of an already mixed room to approve a new arrival", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    await database
      .update(schema.rooms)
      .set({ capacity: 3, genderPolicy: "mixed" })
      .where(eq(schema.rooms.id, "room-one"));
    await database.insert(schema.roomAssignments).values({
      id: "assignment-alice",
      tripId: trip.id,
      roomId: "room-one",
      userId: "alice",
    });

    const request = await store.createRequest(trip.id, "cara", [
      { userId: "cara", expectedRoomId: "room-two", targetRoomId: "room-one" },
    ]);
    expect(request).toMatchObject({
      status: "pending",
      requiredConsents: ["alice", "ben", "cara"],
    });
    await expect(
      store.consent(trip.id, request.id, "alice", true),
    ).resolves.toEqual({ status: "pending" });
    await expect(
      store.consent(trip.id, request.id, "ben", true),
    ).resolves.toEqual({ status: "applied" });
    const [stored] = await database
      .select()
      .from(schema.roomChangeRequests)
      .where(eq(schema.roomChangeRequests.id, request.id));
    expect(JSON.parse(stored?.approvedConsentsJson ?? "[]").sort()).toEqual([
      "alice",
      "ben",
      "cara",
    ]);
  });

  it("requires every occupant to consent to a vacancy claim when composition is unconfirmed", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    await database
      .update(schema.tripMemberships)
      .set({ genderConfirmed: false })
      .where(eq(schema.tripMemberships.userId, "ben"));

    const request = await store.createRequest(trip.id, "alice", [
      { userId: "alice", expectedRoomId: null, targetRoomId: "room-one" },
    ]);
    expect(request).toMatchObject({
      status: "pending",
      requiredConsents: ["alice", "ben"],
    });
    const view = await getRoomingView(database, trip.id, "alice");
    expect(view?.rooms.find(({ id }) => id === "room-one")?.occupiedCount).toBe(
      1,
    );
    await expect(
      store.consent(trip.id, request.id, "ben", true),
    ).resolves.toEqual({
      status: "applied",
    });
  });

  it("lets a traveler leave a mixed room for a compatible vacancy without source-room consent", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    const mixedRoom = "room-mixed";
    await database.insert(schema.rooms).values({
      id: mixedRoom,
      tripId: trip.id,
      name: "Chambre mixte",
      capacity: 4,
      genderPolicy: "mixed",
    });
    await database.update(schema.roomAssignments).set({ roomId: mixedRoom });
    await database.insert(schema.roomAssignments).values({
      id: "assignment-alice",
      tripId: trip.id,
      roomId: mixedRoom,
      userId: "alice",
    });
    await expect(
      store.createRequest(trip.id, "alice", [
        {
          userId: "alice",
          expectedRoomId: mixedRoom,
          targetRoomId: "room-two",
        },
      ]),
    ).resolves.toMatchObject({
      status: "applied",
      requiredConsents: ["alice"],
    });
  });

  it("invalidates a pending vacancy claim if the unassigned traveler leaves the trip", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    const request = await store.createRequest(trip.id, "alice", [
      { userId: "alice", expectedRoomId: null, targetRoomId: "room-one" },
    ]);
    expect(request.status).toBe("pending");
    await database
      .delete(schema.tripMemberships)
      .where(eq(schema.tripMemberships.userId, "alice"));
    await expect(
      store.consent(trip.id, request.id, "ben", true),
    ).resolves.toEqual({
      status: "stale",
    });
    expect(
      await database
        .select()
        .from(schema.roomAssignments)
        .where(eq(schema.roomAssignments.userId, "alice")),
    ).toEqual([]);
  });

  it("requires consent for an uncertain swap and rejects legacy approvals that omit an occupant", async () => {
    const { database, trip } = await createFixture();
    const store = createRoomingStore(database);
    await database
      .update(schema.tripMemberships)
      .set({ genderConfirmed: false })
      .where(eq(schema.tripMemberships.userId, "alice"));
    await database.insert(schema.roomAssignments).values({
      id: "assignment-alice",
      tripId: trip.id,
      roomId: "room-two",
      userId: "alice",
    });
    const request = await store.createRequest(trip.id, "ben", [
      { userId: "ben", expectedRoomId: "room-one", targetRoomId: "room-two" },
      { userId: "cara", expectedRoomId: "room-two", targetRoomId: "room-one" },
    ]);
    expect(request).toMatchObject({
      status: "pending",
      requiredConsents: ["alice", "ben", "cara"],
    });
    // A pending request written under the previous rule omitted Alice.
    await database
      .update(schema.roomChangeRequests)
      .set({ requiredConsentsJson: JSON.stringify(["ben", "cara"]) })
      .where(eq(schema.roomChangeRequests.id, request.id));
    await expect(
      store.consent(trip.id, request.id, "cara", true),
    ).resolves.toEqual({
      status: "stale",
    });
    const [assignment] = await database
      .select()
      .from(schema.roomAssignments)
      .where(eq(schema.roomAssignments.userId, "ben"));
    expect(assignment?.roomId).toBe("room-one");
  });

  it("marks a vacancy request stale when a roster import removes a required occupant", async () => {
    const { database, trip } = await createFixture();
    await database.insert(schema.tripRegistrations).values({
      id: "ben-registration",
      tripId: trip.id,
      reference: "book-ben",
      userId: "ben",
      status: "validated",
      sourceEmail: "ben@example.com",
      firstName: "Ben",
      lastName: "Boreal",
    });
    const request = await createRoomingStore(database).createRequest(
      trip.id,
      "alice",
      [{ userId: "alice", expectedRoomId: null, targetRoomId: "room-one" }],
    );
    expect(request.status).toBe("pending");
    await importValidatedRoster(database, trip.id, []);
    const [stored] = await database
      .select()
      .from(schema.roomChangeRequests)
      .where(eq(schema.roomChangeRequests.id, request.id));
    expect(stored?.status).toBe("stale");
  });

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

describe("organizer room exchange", () => {
  it("atomically exchanges occupants with a full room and records both moves", async () => {
    const { database, trip } = await createFixture();
    await database.insert(schema.roomAssignments).values({
      id: "assignment-alice",
      tripId: trip.id,
      roomId: "room-one",
      userId: "alice",
    });
    await database
      .update(schema.rooms)
      .set({ isLocked: true })
      .where(eq(schema.rooms.id, "room-one"));
    const initialVersions = new Map(
      (
        await database
          .select({
            id: schema.rooms.id,
            compositionVersion: schema.rooms.compositionVersion,
          })
          .from(schema.rooms)
      ).map(({ id, compositionVersion }) => [id, compositionVersion]),
    );

    const result = await staffMoveTraveler(
      database,
      trip.id,
      "cara",
      "room-two",
      "room-one",
      "ben",
      "ben",
    );

    expect(result).toEqual({ status: "exchanged" });
    const assignments = await database
      .select({
        userId: schema.roomAssignments.userId,
        roomId: schema.roomAssignments.roomId,
      })
      .from(schema.roomAssignments)
      .orderBy(schema.roomAssignments.userId);
    expect(assignments).toEqual([
      { userId: "alice", roomId: "room-one" },
      { userId: "ben", roomId: "room-two" },
      { userId: "cara", roomId: "room-one" },
    ]);
    const rooms = await database
      .select({
        id: schema.rooms.id,
        compositionVersion: schema.rooms.compositionVersion,
        isLocked: schema.rooms.isLocked,
      })
      .from(schema.rooms)
      .orderBy(schema.rooms.id);
    expect(rooms).toEqual([
      {
        id: "room-one",
        compositionVersion: (initialVersions.get("room-one") ?? 0) + 1,
        isLocked: true,
      },
      {
        id: "room-two",
        compositionVersion: (initialVersions.get("room-two") ?? 0) + 1,
        isLocked: false,
      },
    ]);
    const [history] = await database
      .select({ changesJson: schema.roomAssignmentHistory.changesJson })
      .from(schema.roomAssignmentHistory);
    expect(JSON.parse(history?.changesJson ?? "[]")).toHaveLength(2);
  });

  it("rejects a stale exchange without changing assignments, versions, or history", async () => {
    const { database, trip } = await createFixture();
    const now = new Date();
    await database.insert(schema.users).values({
      id: "dave",
      name: "Dave",
      email: "dave@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(schema.tripMemberships).values({
      id: "membership-dave",
      tripId: trip.id,
      userId: "dave",
      role: "traveler",
      firstName: "Dave",
      lastName: "Drift",
      gender: "M",
      genderConfirmed: true,
    });
    await database.insert(schema.roomAssignments).values({
      id: "assignment-alice",
      tripId: trip.id,
      roomId: "room-one",
      userId: "alice",
    });
    await database.insert(schema.roomAssignments).values({
      id: "assignment-dave",
      tripId: trip.id,
      roomId: "room-one",
      userId: "dave",
    });
    await database
      .update(schema.roomAssignments)
      .set({ roomId: "room-two" })
      .where(
        and(
          eq(schema.roomAssignments.tripId, trip.id),
          eq(schema.roomAssignments.userId, "alice"),
        ),
      );
    const beforeAssignments = await database
      .select({
        userId: schema.roomAssignments.userId,
        roomId: schema.roomAssignments.roomId,
      })
      .from(schema.roomAssignments)
      .orderBy(schema.roomAssignments.userId);
    const beforeRooms = await database
      .select({
        id: schema.rooms.id,
        compositionVersion: schema.rooms.compositionVersion,
        genderPolicy: schema.rooms.genderPolicy,
      })
      .from(schema.rooms)
      .orderBy(schema.rooms.id);

    const result = await staffMoveTraveler(
      database,
      trip.id,
      "cara",
      "room-two",
      "room-one",
      "ben",
      "alice",
    );

    expect(result).toEqual({ error: "room_composition_changed" });
    expect(
      await database
        .select({
          userId: schema.roomAssignments.userId,
          roomId: schema.roomAssignments.roomId,
        })
        .from(schema.roomAssignments)
        .orderBy(schema.roomAssignments.userId),
    ).toEqual(beforeAssignments);
    expect(
      await database
        .select({
          id: schema.rooms.id,
          compositionVersion: schema.rooms.compositionVersion,
          genderPolicy: schema.rooms.genderPolicy,
        })
        .from(schema.rooms)
        .orderBy(schema.rooms.id),
    ).toEqual(beforeRooms);
    expect(
      await database.select().from(schema.roomAssignmentHistory),
    ).toHaveLength(0);
  });
});
