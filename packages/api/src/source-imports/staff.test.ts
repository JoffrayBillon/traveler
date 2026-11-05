import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "../schema";
import type { StaffImportRow } from "../source-import/types";
import { createTripsStore } from "../trips";
import { InvalidStaffTransportMappingError } from "./errors";
import { importStaffRows, previewStaffImport } from "./staff";

const clients: ReturnType<typeof createClient>[] = [];
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

function staffRow(overrides: Partial<StaffImportRow> = {}): StaffImportRow {
  return {
    row: 2,
    firstName: "Alex",
    lastName: "Voyageur",
    email: "alex@example.com",
    gender: "F",
    role: "companion",
    isVip: false,
    activityProfile: "ski",
    skiDayThree: false,
    transportMode: "train",
    departureCity: "Paris",
    ...overrides,
  };
}

async function createDatabase() {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  const database = drizzle({ client, schema });
  const migrationFiles = (await readdir(migrationsDirectory))
    // This fixture provisions its own accounts and trips.
    .filter(
      (file) =>
        file.endsWith(".sql") && file !== "0012_bootstrap_empty_site.sql",
    )
    .sort();
  for (const file of migrationFiles) {
    const migration = await readFile(join(migrationsDirectory, file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.execute(statement);
    }
  }
  const trip = await createTripsStore(database).create("Ski 2027");
  const now = new Date();
  await database.insert(schema.users).values({
    id: "import-manager",
    name: "Import Manager",
    email: "manager@example.com",
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(schema.tripMemberships).values({
    id: "import-manager-membership",
    tripId: trip.id,
    userId: "import-manager",
    role: "manager",
    firstName: "Import",
    lastName: "Manager",
    gender: null,
  });
  return { client, database, trip };
}

async function createTransportGroup(
  database: Awaited<ReturnType<typeof createDatabase>>["database"],
  tripId: string,
  id: string,
  name: string,
  city: string,
) {
  await database.insert(schema.transportGroups).values({
    id,
    tripId,
    name,
    sourceCity: city,
    normalizedCity: city.trim().toLocaleLowerCase("fr-FR"),
    isDraft: false,
    outboundMeetingAt: null,
    outboundMeetingPlace: null,
    returnMeetingAt: null,
    returnMeetingPlace: null,
  });
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("companions and VIP transport import", () => {
  it("matches configured groups, creates draft groups and stays idempotent", async () => {
    const { database, trip } = await createDatabase();
    await createTransportGroup(
      database,
      trip.id,
      "paris-group",
      "Paris",
      "Paris",
    );
    const rows = [
      staffRow({ email: "paris@example.com", departureCity: "Paris" }),
      staffRow({
        row: 3,
        email: "lyon@example.com",
        departureCity: "Lyon",
      }),
      staffRow({
        row: 4,
        email: "none@example.com",
        transportMode: "none",
        departureCity: null,
      }),
    ];

    const preview = await previewStaffImport(database, trip.id, rows);
    expect(preview.transportRows).toEqual([
      expect.objectContaining({
        sourceCity: "Paris",
        participantCount: 1,
        action: "matched",
        groupId: "paris-group",
      }),
      expect.objectContaining({
        sourceCity: "Lyon",
        participantCount: 1,
        action: "create_draft",
        candidates: [],
      }),
    ]);
    expect(preview.transportSummary).toEqual({
      groupedParticipants: 2,
      noTransportParticipants: 1,
      matchedGroups: 1,
      draftGroups: 1,
      ambiguousCities: 0,
    });

    const first = await importStaffRows(
      database,
      trip.id,
      rows,
      [],
      {},
      {},
      "import-manager",
    );
    const second = await importStaffRows(
      database,
      trip.id,
      rows,
      [],
      {},
      {},
      "import-manager",
    );

    expect(first).toEqual({ created: 3, updated: 0 });
    expect(second).toEqual({ created: 0, updated: 3 });
    const assignments = await database
      .select({
        userId: schema.transportGroupAssignments.userId,
        groupId: schema.transportGroupAssignments.groupId,
      })
      .from(schema.transportGroupAssignments)
      .where(eq(schema.transportGroupAssignments.tripId, trip.id));
    expect(assignments).toHaveLength(2);
    expect(
      assignments.some((assignment) => assignment.groupId === "paris-group"),
    ).toBe(true);
    expect(
      assignments.some((assignment) => assignment.groupId !== "paris-group"),
    ).toBe(true);
    const groups = await database
      .select({
        name: schema.transportGroups.name,
        isDraft: schema.transportGroups.isDraft,
      })
      .from(schema.transportGroups)
      .where(eq(schema.transportGroups.tripId, trip.id));
    expect(groups).toHaveLength(2);
    expect(groups).toContainEqual({ name: "Lyon", isDraft: true });
    const details = await database
      .select({
        email: schema.users.email,
        choice: schema.travelerDetails.transportChoice,
        mode: schema.travelerDetails.transportMode,
        city: schema.travelerDetails.departureCity,
      })
      .from(schema.travelerDetails)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.travelerDetails.userId),
      )
      .where(eq(schema.travelerDetails.tripId, trip.id));
    expect(details).toHaveLength(3);
    expect(details).toContainEqual({
      email: "none@example.com",
      choice: "none",
      mode: "none",
      city: null,
    });
    expect(details.filter((detail) => detail.choice === "group")).toHaveLength(
      2,
    );
    const draftCount = await database
      .select({ count: sql<number>`count(*)` })
      .from(schema.transportGroups)
      .where(eq(schema.transportGroups.isDraft, true));
    expect(Number(draftCount[0]?.count)).toBe(1);
  });

  it("requires an explicit group choice when a city matches multiple groups", async () => {
    const { database, trip } = await createDatabase();
    await createTransportGroup(
      database,
      trip.id,
      "paris-one",
      "Paris 1",
      "Paris",
    );
    await createTransportGroup(
      database,
      trip.id,
      "paris-two",
      "Paris 2",
      "Paris",
    );
    const rows = [staffRow()];
    const preview = await previewStaffImport(database, trip.id, rows);

    expect(preview.transportRows[0]).toMatchObject({
      action: "choose_group",
      candidates: [
        { id: "paris-one", name: "Paris 1" },
        { id: "paris-two", name: "Paris 2" },
      ],
    });
    await expect(
      importStaffRows(database, trip.id, rows, [], {}, {}, "import-manager"),
    ).rejects.toBeInstanceOf(InvalidStaffTransportMappingError);
    expect(await database.select().from(schema.users)).toHaveLength(1);

    await expect(
      importStaffRows(
        database,
        trip.id,
        rows,
        [],
        {},
        { paris: "paris-two" },
        "import-manager",
      ),
    ).resolves.toEqual({ created: 1, updated: 0 });
    const [assignment] = await database
      .select({ groupId: schema.transportGroupAssignments.groupId })
      .from(schema.transportGroupAssignments)
      .where(eq(schema.transportGroupAssignments.tripId, trip.id));
    expect(assignment?.groupId).toBe("paris-two");
  });
});
