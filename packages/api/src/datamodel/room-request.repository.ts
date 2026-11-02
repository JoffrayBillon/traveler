import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import type { RoomMove } from "../services/rooming/model";
import { getTripMembershipRole } from "./trip-membership.repository";

type RoomingTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

export async function staleRoomRequestsForRooms(
  transaction: RoomingTransaction,
  tripId: string,
  roomIds: string[],
  exceptRequestId?: string,
) {
  if (roomIds.length === 0) return;
  const pending = await transaction
    .select({
      id: schema.roomChangeRequests.id,
      changesJson: schema.roomChangeRequests.changesJson,
    })
    .from(schema.roomChangeRequests)
    .where(
      and(
        eq(schema.roomChangeRequests.tripId, tripId),
        eq(schema.roomChangeRequests.status, "pending"),
      ),
    );
  const affected = pending
    .filter((request) => {
      if (request.id === exceptRequestId) return false;
      const payload = JSON.parse(request.changesJson) as {
        roomVersions?: Record<string, number>;
      };
      return roomIds.some((roomId) => roomId in (payload.roomVersions ?? {}));
    })
    .map((request) => request.id);
  if (affected.length === 0) return;
  await transaction
    .update(schema.roomChangeRequests)
    .set({ status: "stale", updatedAt: new Date() })
    .where(inArray(schema.roomChangeRequests.id, affected));
}

export async function listRoomRequestsForMember(
  database: AppDatabase,
  tripId: string,
  userId: string,
) {
  const actor = await getTripMembershipRole(database, tripId, userId);
  if (!actor) return null;

  const now = new Date();
  await database
    .update(schema.roomChangeRequests)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(schema.roomChangeRequests.tripId, tripId),
        eq(schema.roomChangeRequests.status, "pending"),
        sql`${schema.roomChangeRequests.expiresAt} <= ${now.getTime()}`,
      ),
    );

  const records = await database
    .select()
    .from(schema.roomChangeRequests)
    .where(
      and(
        eq(schema.roomChangeRequests.tripId, tripId),
        ...(actor.role === "traveler"
          ? [
              sql`(${schema.roomChangeRequests.requesterUserId} = ${userId} OR EXISTS (
                SELECT 1
                FROM json_each(${schema.roomChangeRequests.requiredConsentsJson}) AS consent
                WHERE consent.value = ${userId}
              ))`,
            ]
          : []),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${schema.roomChangeRequests.status} = 'pending' THEN 0 ELSE 1 END`,
      schema.roomChangeRequests.updatedAt,
    )
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
        requesterUserId: record.requesterUserId,
        status: record.status,
        expiresAt: record.expiresAt,
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
