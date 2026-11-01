import { and, eq, sql } from "drizzle-orm";
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
  for (const registration of cancelledRegistrations) {
    await transaction
      .update(schema.tripRegistrations)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.reference, registration.reference),
        ),
      );
  }
  for (const userId of cancelledUserIds) {
    const remainsActive = await transaction
      .select({ id: schema.tripRegistrations.id })
      .from(schema.tripRegistrations)
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.userId, userId),
          eq(schema.tripRegistrations.status, "validated"),
        ),
      )
      .limit(1);
    if (remainsActive.length || activeUserIds.has(userId)) continue;
    const [membership] = await transaction
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    const priorAssignments = await transaction
      .select({ roomId: schema.roomAssignments.roomId })
      .from(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          eq(schema.roomAssignments.userId, userId),
        ),
      );
    await transaction
      .delete(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          eq(schema.roomAssignments.userId, userId),
        ),
      );
    for (const { roomId } of priorAssignments) {
      const remainingGenders = await transaction
        .select({ gender: schema.tripMemberships.gender })
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
            eq(schema.roomAssignments.roomId, roomId),
          ),
        );
      const genders = new Set(
        remainingGenders
          .map(({ gender }) => gender)
          .filter((gender): gender is "M" | "F" => gender !== null),
      );
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
    if (!membership || membership.role === "traveler") {
      await transaction
        .delete(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, userId),
          ),
        );
    }
  }
  return cancelledRegistrations.length;
}
