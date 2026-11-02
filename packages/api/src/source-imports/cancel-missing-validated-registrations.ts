import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

type DatabaseTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

export async function cancelMissingValidatedRegistrations(
  transaction: DatabaseTransaction,
  tripId: string,
  previousActiveRows: { reference: string; userId: string | null }[],
  incomingReferences: ReadonlySet<string>,
  activeUserIds: ReadonlySet<string>,
  now: Date,
) {
  const cancelledRegistrations = previousActiveRows.filter(
    (row) => !incomingReferences.has(row.reference),
  );
  const cancelledUserIds = new Set(
    cancelledRegistrations
      .map(({ userId }) => userId)
      .filter((id): id is string => Boolean(id)),
  );
  const cancelledReferences = cancelledRegistrations.map(
    ({ reference }) => reference,
  );
  if (cancelledReferences.length)
    await transaction
      .update(schema.tripRegistrations)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          inArray(schema.tripRegistrations.reference, cancelledReferences),
        ),
      );
  if (cancelledUserIds.size === 0) return cancelledRegistrations.length;

  const userIds = [...cancelledUserIds];
  const [remainingRegistrations, memberships, priorAssignments] =
    await Promise.all([
      transaction
        .select({ userId: schema.tripRegistrations.userId })
        .from(schema.tripRegistrations)
        .where(
          and(
            eq(schema.tripRegistrations.tripId, tripId),
            eq(schema.tripRegistrations.status, "validated"),
            inArray(schema.tripRegistrations.userId, userIds),
          ),
        ),
      transaction
        .select({
          userId: schema.tripMemberships.userId,
          role: schema.tripMemberships.role,
        })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            inArray(schema.tripMemberships.userId, userIds),
          ),
        ),
      transaction
        .select({
          userId: schema.roomAssignments.userId,
          roomId: schema.roomAssignments.roomId,
        })
        .from(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            inArray(schema.roomAssignments.userId, userIds),
          ),
        ),
    ]);
  const remainingUserIds = new Set(
    remainingRegistrations
      .map(({ userId }) => userId)
      .filter((id): id is string => Boolean(id)),
  );
  const usersToRelease = userIds.filter(
    (userId) => !remainingUserIds.has(userId) && !activeUserIds.has(userId),
  );

  if (usersToRelease.length) {
    const usersToReleaseSet = new Set(usersToRelease);
    await transaction
      .delete(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          inArray(schema.roomAssignments.userId, usersToRelease),
        ),
      );
    const roomIds = [
      ...new Set(
        priorAssignments
          .filter(({ userId }) => usersToReleaseSet.has(userId))
          .map(({ roomId }) => roomId),
      ),
    ];
    if (roomIds.length) {
      const remainingAssignments = await transaction
        .select({
          roomId: schema.roomAssignments.roomId,
          gender: schema.tripMemberships.gender,
        })
        .from(schema.roomAssignments)
        .innerJoin(
          schema.tripMemberships,
          and(
            eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
            eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
          ),
        )
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            inArray(schema.roomAssignments.roomId, roomIds),
          ),
        );
      const gendersByRoom = new Map<string, Set<"M" | "F">>();
      for (const { roomId, gender } of remainingAssignments) {
        if (!gender) continue;
        const genders = gendersByRoom.get(roomId) ?? new Set<"M" | "F">();
        genders.add(gender);
        gendersByRoom.set(roomId, genders);
      }
      for (const roomId of roomIds) {
        const genders = gendersByRoom.get(roomId) ?? new Set<"M" | "F">();
        const genderPolicy =
          genders.size === 0
            ? "unset"
            : genders.size > 1
              ? "mixed"
              : "single_gender";
        await transaction
          .update(schema.rooms)
          .set({
            genderPolicy,
            compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
          })
          .where(
            and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)),
          );
      }
    }
    const membershipByUser = new Map(
      memberships.map((membership) => [membership.userId, membership]),
    );
    const travelerIds = usersToRelease.filter((userId) => {
      const membership = membershipByUser.get(userId);
      return !membership || membership.role === "traveler";
    });
    if (travelerIds.length)
      await transaction
        .delete(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            inArray(schema.tripMemberships.userId, travelerIds),
          ),
        );
  }
  return cancelledRegistrations.length;
}
