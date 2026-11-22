import { and, eq, isNull, or, type SQL, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import { revokeMagicLinksForAddress } from "./magic-link.repository";
import { refreshRoomComposition } from "./traveler.repository";

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export async function deleteTripParticipantData(
  transaction: Transaction,
  tripId: string,
  userId: string,
  email: string,
) {
  const registrations = schema.tripRegistrations;
  await transaction
    .delete(registrations)
    .where(
      and(
        eq(registrations.tripId, tripId),
        or(
          eq(registrations.userId, userId),
          and(
            isNull(registrations.userId),
            eq(registrations.sourceEmail, email),
          ),
        ),
      ),
    );

  const blobPaths = await queueTicketDeletion(transaction, userId, tripId);

  await transaction
    .update(schema.transportTickets)
    .set({ uploadedBy: null })
    .where(
      and(
        eq(schema.transportTickets.tripId, tripId),
        eq(schema.transportTickets.uploadedBy, userId),
      ),
    );
  await transaction
    .delete(schema.transportGroupAssignments)
    .where(
      and(
        eq(schema.transportGroupAssignments.tripId, tripId),
        eq(schema.transportGroupAssignments.userId, userId),
      ),
    );
  await transaction
    .update(schema.transportGroupAssignments)
    .set({ assignedBy: null })
    .where(
      and(
        eq(schema.transportGroupAssignments.tripId, tripId),
        eq(schema.transportGroupAssignments.assignedBy, userId),
      ),
    );
  await releaseCarpoolPassengers(
    transaction,
    userId,
    eq(schema.travelerDetails.tripId, tripId),
  );
  for (const table of [schema.travelerProfiles, schema.travelerDetails]) {
    await transaction
      .delete(table)
      .where(and(eq(table.tripId, tripId), eq(table.userId, userId)));
  }

  await removeRoomReferences(transaction, tripId, userId);
  await transaction
    .delete(schema.tripMemberships)
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, userId),
      ),
    );
  return blobPaths;
}

async function queueTicketDeletion(
  transaction: Transaction,
  userId: string,
  tripId?: string,
) {
  const tickets = await transaction
    .delete(schema.transportTickets)
    .where(
      and(
        eq(schema.transportTickets.userId, userId),
        tripId === undefined
          ? undefined
          : eq(schema.transportTickets.tripId, tripId),
      ),
    )
    .returning({ blobPath: schema.transportTickets.blobPath });
  if (tickets.length) {
    await transaction
      .insert(schema.pendingTicketBlobDeletions)
      .values(tickets)
      .onConflictDoNothing();
  }
  return tickets.map(({ blobPath }) => blobPath);
}

async function releaseCarpoolPassengers(
  transaction: Transaction,
  userId: string,
  scope?: SQL,
) {
  await transaction
    .update(schema.travelerDetails)
    .set({
      carpoolRole: "undecided",
      carpoolDriverUserId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.travelerDetails.carpoolDriverUserId, userId), scope));
}

async function removeRoomReferences(
  transaction: Transaction,
  tripId: string,
  userId: string,
) {
  const requests = schema.roomChangeRequests;
  await transaction.delete(requests).where(
    and(
      eq(requests.tripId, tripId),
      or(
        eq(requests.requesterUserId, userId),
        sql`EXISTS (
          SELECT 1 FROM json_each(${requests.changesJson}, '$.moves') AS move
          WHERE json_extract(move.value, '$.userId') = ${userId}
        )`,
        sql`EXISTS (
          SELECT 1 FROM json_each(${requests.requiredConsentsJson}) WHERE value = ${userId}
          UNION ALL
          SELECT 1 FROM json_each(${requests.approvedConsentsJson}) WHERE value = ${userId}
        )`,
      ),
    ),
  );
  const history = schema.roomAssignmentHistory;
  const actions = await transaction
    .select()
    .from(history)
    .where(
      and(
        eq(history.tripId, tripId),
        or(
          eq(history.actorUserId, userId),
          sql`EXISTS (
          SELECT 1 FROM json_each(${history.changesJson}) AS change
          WHERE json_extract(change.value, '$.userId') = ${userId}
        )`,
        ),
      ),
    );
  for (const action of actions) {
    const changes = (
      JSON.parse(action.changesJson) as { userId: string }[]
    ).filter((change) => change.userId !== userId);
    if (changes.length === 0) {
      await transaction.delete(history).where(eq(history.id, action.id));
    } else {
      await transaction
        .update(history)
        .set({
          changesJson: JSON.stringify(changes),
          ...(action.actorUserId === userId
            ? { actorUserId: null, actorName: "" }
            : {}),
        })
        .where(eq(history.id, action.id));
    }
  }

  const [assignment] = await transaction
    .delete(schema.roomAssignments)
    .where(
      and(
        eq(schema.roomAssignments.tripId, tripId),
        eq(schema.roomAssignments.userId, userId),
      ),
    )
    .returning({ roomId: schema.roomAssignments.roomId });
  if (assignment) {
    await transaction
      .update(schema.rooms)
      .set({ isLocked: false })
      .where(
        and(
          eq(schema.rooms.tripId, tripId),
          eq(schema.rooms.id, assignment.roomId),
        ),
      );
    await refreshRoomComposition(transaction, tripId, assignment.roomId);
  }
}

export async function deleteAccountWithoutMemberships(
  transaction: Transaction,
  userId: string,
  email: string,
) {
  const [otherMembership] = await transaction
    .select({ id: schema.tripMemberships.id })
    .from(schema.tripMemberships)
    .where(eq(schema.tripMemberships.userId, userId))
    .limit(1);
  if (otherMembership) return [];

  // A roster cancellation removes membership but can leave tickets and carpool references.
  const blobPaths = await queueTicketDeletion(transaction, userId);
  await releaseCarpoolPassengers(transaction, userId);
  await transaction
    .delete(schema.sessions)
    .where(eq(schema.sessions.userId, userId));
  await transaction
    .delete(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
  await transaction
    .update(schema.trainTicketSeats)
    .set({ userId: null })
    .where(eq(schema.trainTicketSeats.userId, userId));
  await transaction.delete(schema.users).where(eq(schema.users.id, userId));
  await revokeMagicLinksForAddress(transaction, email);
  return blobPaths;
}
