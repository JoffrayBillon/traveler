import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it } from "vitest";
import { createRoomingStore, type RoomingError } from "./rooming";
import * as schema from "./schema";
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
