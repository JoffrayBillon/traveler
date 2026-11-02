import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

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
  return rows.length
    ? rows
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
    const roomCount = await transaction
      .select({ count: sql<number>`count(*)` })
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId));
    if ((roomCount[0]?.count ?? 0) > 0)
      return { error: "room_inventory_locked" as const };

    await transaction
      .delete(schema.roomInventory)
      .where(eq(schema.roomInventory.tripId, tripId));
    await transaction
      .insert(schema.roomInventory)
      .values(inventory.map((item) => ({ ...item, tripId })));
    return { inventory };
  });
}
