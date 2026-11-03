import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import { staleRoomRequestsForRooms } from "./room-request.repository";

type RoomingTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

export async function getRoomInventory(
  database: AppDatabase | RoomingTransaction,
  tripId: string,
) {
  const rows = await database
    .select({
      capacity: schema.roomInventory.capacity,
      quantity: schema.roomInventory.quantity,
    })
    .from(schema.roomInventory)
    .where(eq(schema.roomInventory.tripId, tripId))
    .orderBy(schema.roomInventory.capacity);
  if (rows.length) return rows;

  const existingRooms = await database
    .select({
      capacity: schema.rooms.capacity,
      quantity: sql<number>`count(*)`,
    })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId))
    .groupBy(schema.rooms.capacity)
    .orderBy(schema.rooms.capacity);
  return existingRooms.length
    ? existingRooms
    : [
        { capacity: 3, quantity: 18 },
        { capacity: 4, quantity: 29 },
      ];
}

export async function replaceRoomInventory(
  database: AppDatabase,
  tripId: string,
  inventory: { capacity: number; quantity: number }[],
) {
  return database.transaction(async (transaction) => {
    const existingRooms = await transaction
      .select({
        id: schema.rooms.id,
        name: schema.rooms.name,
        capacity: schema.rooms.capacity,
      })
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId));
    const assignments = await transaction
      .select({ roomId: schema.roomAssignments.roomId })
      .from(schema.roomAssignments)
      .where(eq(schema.roomAssignments.tripId, tripId));
    const occupiedCounts = new Map<string, number>();
    for (const assignment of assignments)
      occupiedCounts.set(
        assignment.roomId,
        (occupiedCounts.get(assignment.roomId) ?? 0) + 1,
      );

    const desiredQuantityByCapacity = new Map(
      inventory.map(({ capacity, quantity }) => [capacity, quantity]),
    );
    const roomsByCapacity = new Map<number, typeof existingRooms>();
    for (const room of existingRooms) {
      const current = roomsByCapacity.get(room.capacity) ?? [];
      current.push(room);
      roomsByCapacity.set(room.capacity, current);
    }

    const roomsToRemove: typeof existingRooms = [];
    for (const [capacity, capacityRooms] of roomsByCapacity) {
      const excess =
        capacityRooms.length - (desiredQuantityByCapacity.get(capacity) ?? 0);
      if (excess <= 0) continue;

      const emptyRooms = capacityRooms
        .filter((room) => !occupiedCounts.has(room.id))
        .sort((left, right) => right.name.localeCompare(left.name, "en"));
      if (emptyRooms.length < excess)
        return { error: "room_inventory_contains_occupied_rooms" as const };
      roomsToRemove.push(...emptyRooms.slice(0, excess));
    }

    const removedRoomIds = roomsToRemove.map((room) => room.id);
    if (removedRoomIds.length) {
      await staleRoomRequestsForRooms(transaction, tripId, removedRoomIds);
      await transaction
        .delete(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            inArray(schema.roomAssignments.roomId, removedRoomIds),
          ),
        );
      await transaction
        .delete(schema.rooms)
        .where(
          and(
            eq(schema.rooms.tripId, tripId),
            inArray(schema.rooms.id, removedRoomIds),
          ),
        );
    }

    const removedIds = new Set(removedRoomIds);
    const remainingRooms = existingRooms.filter(
      (room) => !removedIds.has(room.id),
    );
    const remainingQuantityByCapacity = new Map<number, number>();
    for (const room of remainingRooms)
      remainingQuantityByCapacity.set(
        room.capacity,
        (remainingQuantityByCapacity.get(room.capacity) ?? 0) + 1,
      );

    const existingNames = new Set(remainingRooms.map((room) => room.name));
    const numericNames = existingRooms
      .map((room) => Number(room.name))
      .filter(Number.isSafeInteger);
    let nextRoomNumber = Math.max(0, ...numericNames) + 1;
    const roomsToAdd = inventory.flatMap(({ capacity, quantity }) => {
      const additionalCount =
        quantity - (remainingQuantityByCapacity.get(capacity) ?? 0);
      return Array.from({ length: Math.max(0, additionalCount) }, () => {
        let name = String(nextRoomNumber).padStart(2, "0");
        while (existingNames.has(name)) {
          nextRoomNumber += 1;
          name = String(nextRoomNumber).padStart(2, "0");
        }
        existingNames.add(name);
        nextRoomNumber += 1;
        return {
          id: randomUUID(),
          tripId,
          name,
          capacity,
          genderPolicy: "unset" as const,
          compositionVersion: 1,
        };
      });
    });

    if (roomsToAdd.length)
      await transaction.insert(schema.rooms).values(roomsToAdd);

    await transaction
      .delete(schema.roomInventory)
      .where(eq(schema.roomInventory.tripId, tripId));
    await transaction
      .insert(schema.roomInventory)
      .values(inventory.map((item) => ({ ...item, tripId })));
    return {
      inventory,
      added: roomsToAdd.length,
      removed: roomsToRemove.length,
    };
  });
}
