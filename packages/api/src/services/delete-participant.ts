import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import {
  deleteAccountWithoutMemberships,
  deleteTripParticipantData,
} from "../datamodel/participant-deletion.repository";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import { reconcileTrainTicketSeats } from "./tickets/train-ticket-pool";

export function deleteParticipant(
  database: AppDatabase,
  tripId: string,
  actorId: string,
  userId: string,
  confirmationEmail: string,
) {
  return database.transaction(async (transaction) => {
    const actor = await getTripMembershipRole(transaction, tripId, actorId);
    if (!actor) return { error: "not_found" } as const;
    if (actor.role !== "manager") return { error: "forbidden" } as const;

    const [target] = await transaction
      .select({ role: schema.tripMemberships.role, email: schema.users.email })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.users,
        eq(schema.tripMemberships.userId, schema.users.id),
      )
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    if (!target) return { error: "not_found" } as const;
    if (target.role !== "traveler") return { error: "forbidden" } as const;
    const email = normalizeEmail(target.email);
    if (normalizeEmail(confirmationEmail) !== email) {
      return { error: "participant_confirmation_mismatch" } as const;
    }

    const blobPaths = await deleteTripParticipantData(
      transaction,
      tripId,
      userId,
      email,
    );
    await reconcileTrainTicketSeats(transaction, tripId);
    const remainingBlobPaths = await deleteAccountWithoutMemberships(
      transaction,
      userId,
      email,
    );
    return {
      status: "deleted",
      blobPaths: [...blobPaths, ...remainingBlobPaths],
    } as const;
  });
}
