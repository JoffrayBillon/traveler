import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

type RoomingTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

export type RoomAssignmentHistoryAction =
  | "organizer_move"
  | "plan_generation"
  | "plan_reset"
  | "roster_import";

export type RoomAssignmentHistoryChange = {
  userId: string;
  fromRoomId: string | null;
  toRoomId: string | null;
};

export async function recordRoomAssignmentHistory(
  transaction: RoomingTransaction,
  tripId: string,
  actorUserId: string,
  actionType: RoomAssignmentHistoryAction,
  changes: RoomAssignmentHistoryChange[],
) {
  const [actor] = await transaction
    .select({
      firstName: schema.tripMemberships.firstName,
      lastName: schema.tripMemberships.lastName,
    })
    .from(schema.tripMemberships)
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, actorUserId),
      ),
    )
    .limit(1);
  if (!actor) return;

  const userIds = [...new Set(changes.map(({ userId }) => userId))];
  const roomIds = [
    ...new Set(
      changes.flatMap(({ fromRoomId, toRoomId }) =>
        [fromRoomId, toRoomId].filter((roomId): roomId is string => !!roomId),
      ),
    ),
  ];
  const [people, rooms] = await Promise.all([
    userIds.length
      ? transaction
          .select({
            userId: schema.tripMemberships.userId,
            firstName: schema.tripMemberships.firstName,
            lastName: schema.tripMemberships.lastName,
          })
          .from(schema.tripMemberships)
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              inArray(schema.tripMemberships.userId, userIds),
            ),
          )
      : Promise.resolve([]),
    roomIds.length
      ? transaction
          .select({ id: schema.rooms.id, name: schema.rooms.name })
          .from(schema.rooms)
          .where(
            and(
              eq(schema.rooms.tripId, tripId),
              inArray(schema.rooms.id, roomIds),
            ),
          )
      : Promise.resolve([]),
  ]);
  const personById = new Map(people.map((person) => [person.userId, person]));
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  const changesSnapshot = changes.map((change) => {
    const person = personById.get(change.userId);
    return {
      userId: change.userId,
      personName: person ? `${person.firstName} ${person.lastName}`.trim() : "",
      fromRoom: change.fromRoomId
        ? (roomNameById.get(change.fromRoomId) ?? null)
        : null,
      toRoom: change.toRoomId
        ? (roomNameById.get(change.toRoomId) ?? null)
        : null,
    };
  });

  await transaction.insert(schema.roomAssignmentHistory).values({
    id: randomUUID(),
    tripId,
    actorUserId,
    actorName: `${actor.firstName} ${actor.lastName}`.trim(),
    actionType,
    changesJson: JSON.stringify(changesSnapshot),
  });
}

export async function listRoomAssignmentHistory(
  database: AppDatabase,
  tripId: string,
  userId: string,
  isStaff: boolean,
) {
  return database
    .select()
    .from(schema.roomAssignmentHistory)
    .where(
      and(
        eq(schema.roomAssignmentHistory.tripId, tripId),
        ...(isStaff
          ? []
          : [
              sql`(${schema.roomAssignmentHistory.actorUserId} = ${userId} OR EXISTS (
                SELECT 1
                FROM json_each(${schema.roomAssignmentHistory.changesJson}) AS change
                WHERE json_extract(change.value, '$.userId') = ${userId}
              ))`,
            ]),
      ),
    )
    .orderBy(sql`${schema.roomAssignmentHistory.createdAt} DESC`)
    .limit(100);
}
