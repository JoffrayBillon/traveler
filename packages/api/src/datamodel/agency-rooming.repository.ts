import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

export async function ensureAgencyRoomInventory(
  database: AppDatabase,
  tripId: string,
  inventory: { name: string; capacity: number }[],
) {
  return database.transaction(async (transaction) => {
    let rooms = await transaction
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.tripId, tripId));
    if (!rooms.length) {
      await transaction.insert(schema.rooms).values(
        inventory.map((room) => ({
          id: randomUUID(),
          tripId,
          name: room.name,
          capacity: room.capacity,
          genderPolicy: "unset" as const,
          compositionVersion: 1,
        })),
      );
      rooms = await transaction
        .select()
        .from(schema.rooms)
        .where(eq(schema.rooms.tripId, tripId));
    }
    return rooms;
  });
}

export async function listAgencyRoomingMembers(
  database: AppDatabase,
  tripId: string,
) {
  const [members, registrations] = await Promise.all([
    database
      .select({
        userId: schema.tripMemberships.userId,
        role: schema.tripMemberships.role,
        isVip: schema.tripMemberships.isVip,
        firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
        lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
        roomId: schema.roomAssignments.roomId,
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
      .where(eq(schema.tripMemberships.tripId, tripId)),
    database
      .select({
        userId: schema.tripRegistrations.userId,
        sourcePhone: schema.tripRegistrations.sourcePhone,
      })
      .from(schema.tripRegistrations)
      .where(
        and(
          eq(schema.tripRegistrations.tripId, tripId),
          eq(schema.tripRegistrations.status, "validated"),
        ),
      ),
  ]);
  const phoneByUser = new Map<string, string>();
  for (const registration of registrations) {
    if (
      registration.userId &&
      registration.sourcePhone &&
      !phoneByUser.has(registration.userId)
    )
      phoneByUser.set(registration.userId, registration.sourcePhone);
  }
  return { members, phoneByUser };
}
