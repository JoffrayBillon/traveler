import type { AppDatabase } from "../../auth";
import {
  getRoomInventory as loadRoomInventory,
  replaceRoomInventory,
} from "../../datamodel/room-inventory.repository";

export function getRoomInventory(database: AppDatabase, tripId: string) {
  return loadRoomInventory(database, tripId);
}

export function saveRoomInventory(
  database: AppDatabase,
  tripId: string,
  inventory: { capacity: number; quantity: number }[],
) {
  return replaceRoomInventory(database, tripId, inventory);
}
