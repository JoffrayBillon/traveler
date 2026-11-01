import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import type { RoomMove } from "../services/rooming/model";
import { getTripMembershipRole } from "./trip-membership.repository";

export async function listRoomRequestsForMember(
  database: AppDatabase,
  tripId: string,
  userId: string,
) {
  const actor = await getTripMembershipRole(database, tripId, userId);
  if (!actor) return null;

  const records = await database
    .select()
    .from(schema.roomChangeRequests)
    .where(
      and(
        eq(schema.roomChangeRequests.tripId, tripId),
        eq(schema.roomChangeRequests.status, "pending"),
        ...(actor.role === "traveler"
          ? [
              sql`EXISTS (
                SELECT 1
                FROM json_each(${schema.roomChangeRequests.requiredConsentsJson}) AS consent
                WHERE consent.value = ${userId}
              )`,
            ]
          : []),
      ),
    )
    .orderBy(schema.roomChangeRequests.createdAt)
    .limit(100);

  const userIds = new Set<string>();
  const roomIds = new Set<string>();
  for (const record of records) {
    const required = JSON.parse(record.requiredConsentsJson) as string[];
    for (const requiredUserId of required) userIds.add(requiredUserId);
    const payload = JSON.parse(record.changesJson) as { moves: RoomMove[] };
    for (const move of payload.moves) {
      userIds.add(move.userId);
      if (move.expectedRoomId) roomIds.add(move.expectedRoomId);
      roomIds.add(move.targetRoomId);
    }
  }

  const people = userIds.size
    ? await database
        .select({
          userId: schema.tripMemberships.userId,
          firstName: schema.tripMemberships.firstName,
          lastName: schema.tripMemberships.lastName,
        })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            inArray(schema.tripMemberships.userId, [...userIds]),
          ),
        )
    : [];
  const rooms = roomIds.size
    ? await database
        .select({ id: schema.rooms.id, name: schema.rooms.name })
        .from(schema.rooms)
        .where(
          and(
            eq(schema.rooms.tripId, tripId),
            inArray(schema.rooms.id, [...roomIds]),
          ),
        )
    : [];
  const personById = new Map(people.map((person) => [person.userId, person]));
  const roomById = new Map(rooms.map((room) => [room.id, room.name]));

  return {
    requests: records.map((record) => {
      const requiredConsents = JSON.parse(
        record.requiredConsentsJson,
      ) as string[];
      const approvedConsents = JSON.parse(
        record.approvedConsentsJson,
      ) as string[];
      const payload = JSON.parse(record.changesJson) as { moves: RoomMove[] };
      return {
        id: record.id,
        requester: personById.get(record.requesterUserId),
        requiredConsents: requiredConsents.map((consentUserId) => ({
          ...personById.get(consentUserId),
          userId: consentUserId,
          approved: approvedConsents.includes(consentUserId),
        })),
        moves: payload.moves.map((move) => ({
          ...move,
          person: personById.get(move.userId),
          currentRoom: move.expectedRoomId
            ? roomById.get(move.expectedRoomId)
            : null,
          targetRoom: roomById.get(move.targetRoomId),
        })),
        createdAt: record.createdAt,
      };
    }),
  };
}
