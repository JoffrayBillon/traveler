import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import { normalizeEmail } from "../../email";
import * as schema from "../../schema";
import { RoomingError, type RoomMove } from "./model";

export async function resolveRoomExchangeMoves(
  database: AppDatabase,
  tripId: string,
  requesterUserId: string,
  targetRoomId: string,
  exchangeWithEmail: string,
) {
  const [requesterAssignment] = await database
    .select({ roomId: schema.roomAssignments.roomId })
    .from(schema.roomAssignments)
    .where(
      and(
        eq(schema.roomAssignments.tripId, tripId),
        eq(schema.roomAssignments.userId, requesterUserId),
      ),
    )
    .limit(1);
  const [exchangePerson] = await database
    .select({
      userId: schema.tripMemberships.userId,
      roomId: schema.roomAssignments.roomId,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .innerJoin(
      schema.roomAssignments,
      and(
        eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
        eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
      ),
    )
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.roomAssignments.roomId, targetRoomId),
        eq(
          sql<string>`lower(${schema.users.email})`,
          normalizeEmail(exchangeWithEmail),
        ),
      ),
    )
    .limit(1);
  if (
    !requesterAssignment ||
    !exchangePerson ||
    exchangePerson.userId === requesterUserId
  )
    throw new RoomingError("invalid_room_exchange");
  return [
    {
      userId: requesterUserId,
      expectedRoomId: requesterAssignment.roomId,
      targetRoomId,
    },
    {
      userId: exchangePerson.userId,
      expectedRoomId: targetRoomId,
      targetRoomId: requesterAssignment.roomId,
    },
  ] satisfies RoomMove[];
}
