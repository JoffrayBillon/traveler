import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../schema";
import { batchRows } from "./batch-rows";
import type { DatabaseTransaction } from "./database.types";

export async function applyRegistrationTransport(
  transaction: DatabaseTransaction,
  tripId: string,
  userIds: readonly string[],
  actorUserId?: string,
) {
  for (const ids of batchRows([...new Set(userIds)])) {
    const registrations = await transaction
      .select({
        userId: schema.tripMemberships.userId,
        groupId: schema.tripRegistrations.importedTransportGroupId,
        mode: schema.tripRegistrations.transportMode,
      })
      .from(schema.tripRegistrations)
      .innerJoin(
        schema.tripMemberships,
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, schema.tripRegistrations.userId),
        ),
      )
      .leftJoin(
        schema.travelerDetails,
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, schema.tripMemberships.userId),
        ),
      )
      .leftJoin(
        schema.transportGroupAssignments,
        and(
          eq(schema.transportGroupAssignments.tripId, tripId),
          eq(
            schema.transportGroupAssignments.userId,
            schema.tripMemberships.userId,
          ),
        ),
      )
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.status, "validated"),
          inArray(schema.tripMemberships.userId, ids),
          sql`${schema.transportGroupAssignments.groupId} IS NULL`,
          sql`coalesce(${schema.travelerDetails.transportChoice}, 'unconfirmed') = 'unconfirmed'`,
        ),
      );
    const choices = new Map<string, Set<string | null>>();
    for (const { userId, groupId, mode } of registrations) {
      if (!groupId && mode !== "none") continue;
      const options = choices.get(userId) ?? new Set();
      options.add(groupId);
      choices.set(userId, options);
    }
    const details: (typeof schema.travelerDetails.$inferInsert)[] = [];
    const assignments: (typeof schema.transportGroupAssignments.$inferInsert)[] =
      [];
    for (const [userId, options] of choices) {
      if (options.size !== 1) continue;
      const [groupId] = options;
      if (groupId)
        assignments.push({ tripId, userId, groupId, assignedBy: actorUserId });
      details.push({
        tripId,
        userId,
        transportChoice: groupId ? "group" : "none",
        transportMode: groupId ? null : "none",
        departureCity: null,
        updatedAt: new Date(),
      });
    }
    for (const batch of batchRows(assignments))
      await transaction.insert(schema.transportGroupAssignments).values(batch);
    for (const batch of batchRows(details))
      await transaction
        .insert(schema.travelerDetails)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            schema.travelerDetails.tripId,
            schema.travelerDetails.userId,
          ],
          set: {
            transportChoice: sql`excluded.transport_choice`,
            transportMode: sql`excluded.transport_mode`,
            departureCity: null,
            updatedAt: sql`excluded.updated_at`,
          },
        });
  }
}
