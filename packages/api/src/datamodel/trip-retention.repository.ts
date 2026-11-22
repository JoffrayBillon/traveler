import { and, inArray, isNotNull, lte, notInArray, or, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import type { AppDatabase } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import {
  magicLinkRateLimitKey,
  revokeMagicLinksForAddresses,
} from "./magic-link.repository";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

// Delete children before their parents, including on connections with foreign
// key enforcement disabled.
const tripDataTables = [
  schema.tripImportPreviews,
  schema.tripRegistrations,
  schema.roomChangeRequests,
  schema.roomAssignmentHistory,
  schema.roomAssignments,
  schema.rooms,
  schema.roomInventory,
  schema.transportGroupAssignments,
  schema.transportGroupSegments,
  schema.transportGroups,
  schema.travelerProfiles,
  schema.travelerDetails,
  schema.tripMemberships,
] as const;

const tripAccountTables = [
  schema.tripMemberships,
  schema.tripRegistrations,
  schema.travelerProfiles,
  schema.travelerDetails,
  schema.roomAssignments,
  schema.transportTickets,
  schema.transportGroupAssignments,
] as const;

function tripAccountIds(transaction: Transaction, tripIds?: string[]) {
  const [memberships, registrations, ...otherTables] = tripAccountTables;
  const selectAccounts = (table: (typeof tripAccountTables)[number]) =>
    transaction
      .select({ userId: table.userId })
      .from(table)
      .where(
        and(
          isNotNull(table.userId),
          tripIds ? inArray(table.tripId, tripIds) : undefined,
        ),
      );
  return unionAll(
    selectAccounts(memberships),
    selectAccounts(registrations),
    ...otherTables.map(selectAccounts),
  );
}

export function eraseExpiredTrips(
  database: AppDatabase,
  cutoffDate: string,
  now: Date,
) {
  return database.transaction(async (transaction) => {
    // Technical records expire independently of trip retention.
    await transaction
      .delete(schema.sessions)
      .where(lte(schema.sessions.expiresAt, now));
    await transaction
      .delete(schema.verifications)
      .where(lte(schema.verifications.expiresAt, now));
    await transaction
      .delete(schema.tripImportPreviews)
      .where(lte(schema.tripImportPreviews.expiresAt, now));
    await transaction
      .delete(schema.signInRateLimits)
      .where(lte(schema.signInRateLimits.expiresAt, now.getTime()));
    await transaction
      .delete(schema.rateLimits)
      .where(
        lte(schema.rateLimits.lastRequest, now.getTime() - 24 * 60 * 60 * 1000),
      );

    const expired = await transaction
      .select({ id: schema.trips.id })
      .from(schema.trips)
      .where(
        and(
          lte(schema.trips.endsOn, cutoffDate),
          sql`date(${schema.trips.endsOn}, '+0 days') = ${schema.trips.endsOn}`,
        ),
      );
    const tripIds = expired.map(({ id }) => id);
    if (!tripIds.length) return 0;

    const candidates = await transaction
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(inArray(schema.users.id, tripAccountIds(transaction, tripIds)));
    const tickets = await transaction
      .delete(schema.transportTickets)
      .where(inArray(schema.transportTickets.tripId, tripIds))
      .returning({ blobPath: schema.transportTickets.blobPath });
    await transaction
      .delete(schema.trainTicketSeats)
      .where(inArray(schema.trainTicketSeats.tripId, tripIds));
    const trainDocuments = await transaction
      .delete(schema.trainTicketDocuments)
      .where(inArray(schema.trainTicketDocuments.tripId, tripIds))
      .returning({ blobPath: schema.trainTicketDocuments.blobPath });
    const blobPaths = [...tickets, ...trainDocuments];
    if (blobPaths.length) {
      await transaction
        .insert(schema.pendingTicketBlobDeletions)
        .values(blobPaths)
        .onConflictDoNothing();
    }
    for (const table of tripDataTables) {
      await transaction.delete(table).where(inArray(table.tripId, tripIds));
    }
    await transaction
      .delete(schema.trips)
      .where(inArray(schema.trips.id, tripIds));

    if (candidates.length) {
      await eraseUnneededAccounts(
        transaction,
        candidates.map(({ id }) => id),
      );
    }
    return tripIds.length;
  });
}

async function eraseUnneededAccounts(
  transaction: Transaction,
  candidateIds: string[],
) {
  const accounts = await transaction
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.id, candidateIds),
        notInArray(schema.users.id, tripAccountIds(transaction)),
      ),
    );
  if (!accounts.length) return;

  const ids = accounts.map(({ id }) => id);
  const emails = accounts.map(({ email }) => normalizeEmail(email));
  await revokeMagicLinksForAddresses(transaction, emails);
  await transaction.delete(schema.signInRateLimits).where(
    or(
      inArray(
        schema.signInRateLimits.key,
        emails.map((email) => magicLinkRateLimitKey("address", email)),
      ),
      inArray(
        schema.signInRateLimits.key,
        ids.map((id) => magicLinkRateLimitKey("manager", id)),
      ),
    ),
  );
  await transaction
    .delete(schema.sessions)
    .where(inArray(schema.sessions.userId, ids));
  await transaction
    .delete(schema.accounts)
    .where(inArray(schema.accounts.userId, ids));
  await transaction
    .update(schema.trainTicketSeats)
    .set({ userId: null })
    .where(inArray(schema.trainTicketSeats.userId, ids));
  await transaction
    .update(schema.travelerDetails)
    .set({ carpoolRole: "undecided", carpoolDriverUserId: null })
    .where(inArray(schema.travelerDetails.carpoolDriverUserId, ids));
  await transaction
    .update(schema.roomAssignmentHistory)
    .set({ actorUserId: null, actorName: "" })
    .where(inArray(schema.roomAssignmentHistory.actorUserId, ids));
  await transaction
    .delete(schema.roomChangeRequests)
    .where(inArray(schema.roomChangeRequests.requesterUserId, ids));
  await transaction
    .update(schema.transportTickets)
    .set({ uploadedBy: null })
    .where(inArray(schema.transportTickets.uploadedBy, ids));
  await transaction
    .update(schema.transportGroupAssignments)
    .set({ assignedBy: null })
    .where(inArray(schema.transportGroupAssignments.assignedBy, ids));
  await transaction.delete(schema.users).where(inArray(schema.users.id, ids));
}
