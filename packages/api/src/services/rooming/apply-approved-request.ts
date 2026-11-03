import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import { staleRoomRequestsForRooms } from "../../datamodel/room-request.repository";
import * as schema from "../../schema";
import { type RoomChangePayload, RoomingError } from "./model";

export async function applyApprovedRequest(
  transaction: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
  requestId: string,
  tripId: string,
  payload: RoomChangePayload,
) {
  const roomIds = Object.keys(payload.roomVersions);
  const rooms = roomIds.length
    ? await transaction
        .select()
        .from(schema.rooms)
        .where(
          and(
            eq(schema.rooms.tripId, tripId),
            inArray(schema.rooms.id, roomIds),
          ),
        )
    : [];
  const currentVersions = new Map(
    rooms.map((room) => [room.id, room.compositionVersion]),
  );
  if (
    roomIds.some(
      (roomId) => currentVersions.get(roomId) !== payload.roomVersions[roomId],
    )
  ) {
    throw new RoomingError("room_composition_changed");
  }
  const current = await transaction
    .select({
      userId: schema.roomAssignments.userId,
      roomId: schema.roomAssignments.roomId,
    })
    .from(schema.roomAssignments)
    .where(eq(schema.roomAssignments.tripId, tripId));
  const currentByUser = new Map(
    current.map((assignment) => [assignment.userId, assignment.roomId]),
  );
  for (const move of payload.moves) {
    if ((currentByUser.get(move.userId) ?? null) !== move.expectedRoomId) {
      throw new RoomingError("room_composition_changed");
    }
  }
  for (const move of payload.moves)
    currentByUser.set(move.userId, move.targetRoomId);
  const capacities = new Map(rooms.map((room) => [room.id, room.capacity]));
  const affectedRoomIds = new Set(roomIds);
  const finalCounts = new Map<string, number>();
  for (const roomId of currentByUser.values())
    finalCounts.set(roomId, (finalCounts.get(roomId) ?? 0) + 1);
  if (
    [...finalCounts].some(
      ([roomId, count]) =>
        affectedRoomIds.has(roomId) && count > (capacities.get(roomId) ?? 0),
    )
  ) {
    throw new RoomingError("room_capacity_exceeded");
  }

  for (const move of payload.moves) {
    const existing = await transaction
      .select({ id: schema.roomAssignments.id })
      .from(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          eq(schema.roomAssignments.userId, move.userId),
        ),
      )
      .limit(1);
    if (existing.length) {
      await transaction
        .update(schema.roomAssignments)
        .set({ roomId: move.targetRoomId, assignedAt: new Date() })
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.userId, move.userId),
          ),
        );
    } else {
      await transaction.insert(schema.roomAssignments).values({
        id: randomUUID(),
        tripId,
        roomId: move.targetRoomId,
        userId: move.userId,
      });
    }
  }

  const assignments = await transaction
    .select({
      roomId: schema.roomAssignments.roomId,
      gender: schema.tripMemberships.gender,
      genderConfirmed: schema.tripMemberships.genderConfirmed,
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
  for (const roomId of roomIds) {
    const genders = new Set(
      assignments
        .filter(
          (assignment) =>
            assignment.roomId === roomId && assignment.genderConfirmed,
        )
        .map((assignment) => assignment.gender)
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
        compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
        genderPolicy,
      })
      .where(and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)));
  }
  await staleRoomRequestsForRooms(transaction, tripId, roomIds, requestId);
  await transaction
    .update(schema.roomChangeRequests)
    .set({ status: "applied", updatedAt: new Date() })
    .where(eq(schema.roomChangeRequests.id, requestId));
}
