import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import { staleRoomRequestsForRooms } from "../../datamodel/room-request.repository";
import * as schema from "../../schema";

export async function createRoom(
  database: AppDatabase,
  tripId: string,
  name: string,
  capacity: number,
) {
  const existingNames = await database
    .select({ name: schema.rooms.name })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId));
  if (
    existingNames.some(
      (room) =>
        room.name.trim().toLocaleLowerCase("fr-FR") ===
        name.trim().toLocaleLowerCase("fr-FR"),
    )
  )
    return { error: "room_name_already_exists" as const };

  try {
    const [room] = await database
      .insert(schema.rooms)
      .values({ id: randomUUID(), tripId, name: name.trim(), capacity })
      .returning({
        id: schema.rooms.id,
        name: schema.rooms.name,
        capacity: schema.rooms.capacity,
      });
    return { room };
  } catch {
    return { error: "room_name_already_exists" as const };
  }
}

export async function assignInitialRoom(
  database: AppDatabase,
  tripId: string,
  roomId: string,
  userId: string,
) {
  return database.transaction(async (transaction) => {
    const [target] = await transaction
      .select({
        userId: schema.tripMemberships.userId,
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
      })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    const [room] = await transaction
      .select()
      .from(schema.rooms)
      .where(and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)))
      .limit(1);
    if (!target || !room) return { error: "not_found" as const };
    if (!target.genderConfirmed || !target.gender)
      return { error: "gender_confirmation_required" as const };

    const [existing] = await transaction
      .select({ roomId: schema.roomAssignments.roomId })
      .from(schema.roomAssignments)
      .where(
        and(
          eq(schema.roomAssignments.tripId, tripId),
          eq(schema.roomAssignments.userId, userId),
        ),
      )
      .limit(1);
    if (existing)
      return {
        error:
          existing.roomId === roomId
            ? ("already_assigned" as const)
            : ("room_change_requires_consents" as const),
      };

    const occupants = await transaction
      .select({
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
          eq(schema.roomAssignments.roomId, roomId),
        ),
      );
    if (occupants.length >= room.capacity)
      return { error: "room_capacity_exceeded" as const };

    const currentGenders = new Set(
      occupants
        .filter((occupant) => occupant.genderConfirmed)
        .map((occupant) => occupant.gender)
        .filter((gender): gender is "M" | "F" => gender !== null),
    );
    if (
      room.genderPolicy === "mixed" ||
      (target.gender &&
        currentGenders.size > 0 &&
        !currentGenders.has(target.gender))
    )
      return { error: "room_change_requires_consents" as const };

    await transaction
      .insert(schema.roomAssignments)
      .values({ id: randomUUID(), tripId, roomId, userId });
    const genders = new Set(
      [
        ...occupants
          .filter((occupant) => occupant.genderConfirmed)
          .map((occupant) => occupant.gender),
        target.gender,
      ].filter((gender): gender is "M" | "F" => gender !== null),
    );
    await transaction
      .update(schema.rooms)
      .set({
        compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
        genderPolicy:
          genders.size === 0
            ? "unset"
            : genders.size > 1
              ? "mixed"
              : "single_gender",
      })
      .where(and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)));
    await staleRoomRequestsForRooms(transaction, tripId, [roomId]);
    return { error: null };
  });
}

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
