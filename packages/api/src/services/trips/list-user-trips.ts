import type { AppDatabase } from "../../auth";
import { listTripMembershipsForUser } from "../../datamodel/trip-membership.repository";

export function listUserTrips(database: AppDatabase, userId: string) {
  return listTripMembershipsForUser(database, userId);
}
