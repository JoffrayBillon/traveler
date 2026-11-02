import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import { staleRoomRequestsForRooms } from "../../datamodel/room-request.repository";
import * as schema from "../../schema";

export async function staffMoveTraveler(
  database: AppDatabase,
  tripId: string,
  userId: string,
  expectedRoomId: string | null,
  targetRoomId: string,
) {
  return database.transaction(async (transaction) => {
    const [traveler] = await transaction
      .select({ userId: schema.tripMemberships.userId })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
          eq(schema.tripMemberships.role, "traveler"),
        ),
      )
      .limit(1);
    const [targetRoom] = await transaction
      .select()
      .from(schema.rooms)
      .where(
        and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, targetRoomId)),
      )
      .limit(1);
    if (!traveler || !targetRoom) return { error: "not_found" as const };
    const [current] = await transaction
      .select({ roomId: schema.roomAssignments.roomId })
      .from(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          eq(schema.roomAssignments.userId, userId),
        ),
      )
      .limit(1);
    const currentRoomId = current?.roomId ?? null;
    if (currentRoomId !== expectedRoomId)
      return { error: "room_composition_changed" as const };
    if (currentRoomId === targetRoomId) return { status: "unchanged" as const };
    const targetOccupants = await transaction
      .select({ userId: schema.roomAssignments.userId })
      .from(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          eq(schema.roomAssignments.roomId, targetRoomId),
        ),
      );
    if (targetOccupants.length >= targetRoom.capacity)
      return { error: "room_capacity_exceeded" as const };

    const changedRooms = [targetRoomId];
    if (currentRoomId) {
      changedRooms.push(currentRoomId);
      await transaction
        .delete(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.userId, userId),
          ),
        );
    }
    await transaction.insert(schema.roomAssignments).values({
      id: randomUUID(),
      tripId,
      roomId: targetRoomId,
      userId,
    });

    for (const roomId of new Set(changedRooms)) {
      const genders = await transaction
        .select({ gender: schema.tripMemberships.gender })
        .from(schema.roomAssignments)
        .innerJoin(
          schema.tripMemberships,
          and(
            eq(schema.tripMemberships.tripId, schema.roomAssignments.tripId),
            eq(schema.tripMemberships.userId, schema.roomAssignments.userId),
          ),
        )
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.roomId, roomId),
            eq(schema.tripMemberships.genderConfirmed, true),
          ),
        );
      const knownGenders = new Set(
        genders
          .map(({ gender }) => gender)
          .filter((gender): gender is "M" | "F" => gender !== null),
      );
      await transaction
        .update(schema.rooms)
        .set({
          compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
          genderPolicy:
            knownGenders.size > 1
              ? "mixed"
              : knownGenders.size === 1
                ? "single_gender"
                : "unset",
        })
        .where(
          and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)),
        );
    }
    await staleRoomRequestsForRooms(transaction, tripId, changedRooms);
    return { status: "moved" as const };
  });
}

export async function setRoomLocked(
  database: AppDatabase,
  tripId: string,
  roomId: string,
  userId: string,
  locked: boolean,
  isStaff: boolean,
) {
  return database.transaction(async (transaction) => {
    const [room] = await transaction
      .select({ isLocked: schema.rooms.isLocked })
      .from(schema.rooms)
      .where(and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)))
      .limit(1);
    if (!room) return { error: "not_found" as const };
    if (!isStaff) {
      const [occupancy] = await transaction
        .select({ userId: schema.roomAssignments.userId })
        .from(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.roomId, roomId),
            eq(schema.roomAssignments.userId, userId),
          ),
        )
        .limit(1);
      if (!occupancy) return { error: "forbidden" as const };
    }
    if (room.isLocked === locked) return { locked };
    await transaction
      .update(schema.rooms)
      .set({ isLocked: locked })
      .where(and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)));
    if (locked) await staleRoomRequestsForRooms(transaction, tripId, [roomId]);
    return { locked };
  });
}
