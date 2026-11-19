import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import { personalPhone } from "./personal-phone.query";

export async function listAgencyExportRooms(
  database: AppDatabase,
  tripId: string,
) {
  return database
    .select({
      id: schema.rooms.id,
      name: schema.rooms.name,
      capacity: schema.rooms.capacity,
    })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId));
}

export function listAgencyRoomingMembers(
  database: AppDatabase,
  tripId: string,
) {
  return database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
      lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
      roomId: schema.roomAssignments.roomId,
      personalPhone,
      activityProfile: schema.travelerDetails.activityProfile,
      skiDayThree: schema.travelerDetails.skiDayThree,
      departureCity: schema.travelerDetails.departureCity,
      dietaryRequirements: schema.travelerProfiles.dietaryRequirements,
      allergens: schema.travelerProfiles.allergens,
    })
    .from(schema.tripMemberships)
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
      ),
    )
    .leftJoin(
      schema.travelerDetails,
      and(
        eq(schema.travelerDetails.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerDetails.userId, schema.tripMemberships.userId),
      ),
    )
    .leftJoin(
      schema.roomAssignments,
      and(
        eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
        eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
      ),
    )
    .where(eq(schema.tripMemberships.tripId, tripId));
}
