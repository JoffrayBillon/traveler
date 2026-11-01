import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
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
      .select({ gender: schema.tripMemberships.gender })
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
      [...occupants.map((occupant) => occupant.gender), target.gender].filter(
        (gender): gender is "M" | "F" => gender !== null,
      ),
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
    return { error: null };
  });
}
