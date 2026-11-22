import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it, vi } from "vitest";
import * as schema from "./schema";
import { purgeExpiredTrips } from "./services/purge-expired-trips";
import { renameTrip } from "./services/traveler-details";

it("cleans expired sessions and import previews even with no trip to purge", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    const database = drizzle({ client, schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });

    const now = new Date("2027-06-30T04:00:00Z");
    const expiresLater = new Date(now.getTime() + 60_000);
    const [manager] = await database.select().from(schema.tripMemberships);
    if (!manager) throw new Error("Expected a seeded manager");
    await database.insert(schema.sessions).values(
      [
        { id: "expired", expiresAt: now },
        { id: "active", expiresAt: expiresLater },
      ].map(({ id, expiresAt }) => ({
        id,
        expiresAt,
        token: `token-${id}`,
        userId: manager.userId,
        createdAt: new Date("2027-04-01T00:00:00Z"),
        updatedAt: new Date(now.getTime() - 60_000),
      })),
    );
    await database.insert(schema.tripImportPreviews).values(
      [
        { id: "expired", expiresAt: now },
        { id: "active", expiresAt: expiresLater },
      ].map(({ id, expiresAt }) => ({
        id,
        expiresAt,
        tripId: manager.tripId,
        actorUserId: manager.userId,
        sourceType: "validated_roster" as const,
        contentHash: id,
        baseSnapshotHash: id,
        createdAt: new Date(now.getTime() - 14 * 60_000),
      })),
    );

    const storage = { put: vi.fn(), get: vi.fn(), del: vi.fn() };
    expect(await purgeExpiredTrips(database, storage, now)).toEqual({
      purgedTrips: 0,
      deleted: 0,
      failed: 0,
    });
    for (const table of [schema.sessions, schema.tripImportPreviews]) {
      expect(await database.select({ id: table.id }).from(table)).toEqual([
        { id: "active" },
      ]);
    }
    expect(await database.select().from(schema.tripMemberships)).toContainEqual(
      manager,
    );
    expect(storage.del).not.toHaveBeenCalled();
  } finally {
    await client.close();
  }
});

it.each([true, false])(
  "purges only eligible trip data and retries Blob deletion (foreign keys: %s)",
  async (foreignKeys) => {
    const client = createClient({ url: "file::memory:" });
    try {
      const database = drizzle({ client, schema });
      await migrate(database, {
        migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
      });
      await client.execute(`PRAGMA foreign_keys = ${foreignKeys ? 1 : 0}`);

      const now = new Date("2027-06-30T04:00:00Z");
      await database.insert(schema.trips).values([
        { id: "expired", name: "Expired trip", endsOn: "2027-04-01" },
        { id: "current", name: "Current trip", endsOn: "2027-04-02" },
        { id: "undated", name: "Draft trip" },
        { id: "invalid", name: "Invalid date", endsOn: "2027-02-31" },
      ]);
      expect(
        await renameTrip(database, "expired", "Expired trip", null),
      ).toEqual({
        ok: false,
        error: "invalid_trip_end_date",
      });
      const people = ["former", "shared", "cancelled", "unrelated"];
      await database.insert(schema.users).values(
        people.map((id) => ({
          id,
          name: id,
          email: `${id}@example.test`,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await database.insert(schema.tripMemberships).values(
        (
          [
            ["expired", "former"],
            ["expired", "shared"],
            ["current", "shared"],
          ] as const
        ).map(([tripId, userId]) => ({
          id: `${tripId}-${userId}`,
          tripId,
          userId,
          role: "traveler" as const,
          firstName: userId,
          lastName: "Example",
        })),
      );
      await database.insert(schema.tripRegistrations).values([
        {
          id: "cancelled",
          tripId: "expired",
          userId: "cancelled",
          reference: "cancelled-reference",
          status: "cancelled",
          sourceEmail: "cancelled@example.test",
          firstName: "Cancelled",
          lastName: "Example",
        },
        {
          id: "pending",
          tripId: "expired",
          reference: "pending-reference",
          sourceEmail: "pending@example.test",
          firstName: "Pending",
          lastName: "Example",
        },
      ]);
      await database.insert(schema.travelerProfiles).values([
        { tripId: "expired", userId: "shared", allergens: "expired-profile" },
        { tripId: "current", userId: "shared", allergens: "current-profile" },
      ]);
      await database.insert(schema.roomAssignmentHistory).values({
        id: "history",
        tripId: "expired",
        actorUserId: "former",
        actorName: "Former Traveler",
        actionType: "organizer_move",
        changesJson: '[{"userId":"shared","personName":"Shared Traveler"}]',
      });
      await database.insert(schema.transportTickets).values(
        ["expired", "current"].map((tripId) => ({
          id: tripId,
          tripId,
          userId: "shared",
          kind: "outbound" as const,
          blobPath: `local/${tripId}/ticket`,
          originalName: "ticket.pdf",
          contentType: "application/pdf",
          size: 10,
        })),
      );
      await database.insert(schema.sessions).values(
        people.map((userId) => ({
          id: userId,
          userId,
          token: `token-${userId}`,
          expiresAt: new Date(now.getTime() + 3600000),
          createdAt: now,
          updatedAt: now,
        })),
      );
      await database.insert(schema.accounts).values(
        people.map((userId) => ({
          id: userId,
          userId,
          providerId: "credential",
          accountId: userId,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await database.insert(schema.verifications).values(
        people.map((id) => ({
          id,
          identifier: `magic-link:${id}`,
          value: JSON.stringify({ email: `${id}@example.test` }),
          expiresAt: new Date(now.getTime() + 3600000),
          createdAt: now,
          updatedAt: now,
        })),
      );
      const deleteBlob = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary storage failure"))
        .mockResolvedValue(undefined);
      const storage = { put: vi.fn(), get: vi.fn(), del: deleteBlob };

      expect(await purgeExpiredTrips(database, storage, now)).toEqual({
        purgedTrips: 1,
        deleted: 0,
        failed: 1,
      });
      const remainingTrips = (await database.select().from(schema.trips)).map(
        ({ id }) => id,
      );
      expect(remainingTrips).toEqual(
        expect.arrayContaining(["current", "undated", "invalid"]),
      );
      expect(remainingTrips).not.toContain("expired");
      for (const table of [
        schema.tripMemberships,
        schema.tripRegistrations,
        schema.travelerProfiles,
        schema.roomAssignmentHistory,
        schema.transportTickets,
      ]) {
        expect(
          await database
            .select()
            .from(table)
            .where(eq(table.tripId, "expired")),
        ).toEqual([]);
      }
      expect(
        await database.select().from(schema.travelerProfiles),
      ).toMatchObject([
        { tripId: "current", userId: "shared", allergens: "current-profile" },
      ]);
      for (const table of [
        schema.users,
        schema.accounts,
        schema.sessions,
        schema.verifications,
      ]) {
        expect(
          (
            await database
              .select({ id: table.id })
              .from(table)
              .where(inArray(table.id, people))
              .orderBy(table.id)
          ).map(({ id }) => id),
        ).toEqual(["shared", "unrelated"]);
      }
      expect(
        await database.select().from(schema.pendingTicketBlobDeletions),
      ).toEqual([{ blobPath: "local/expired/ticket", availableAt: 0 }]);
      expect(await purgeExpiredTrips(database, storage, now)).toEqual({
        purgedTrips: 0,
        deleted: 1,
        failed: 0,
      });
      expect(deleteBlob.mock.calls).toEqual([
        ["local/expired/ticket"],
        ["local/expired/ticket"],
      ]);
      expect(
        await database.select().from(schema.pendingTicketBlobDeletions),
      ).toEqual([]);
    } finally {
      await client.close();
    }
  },
);
