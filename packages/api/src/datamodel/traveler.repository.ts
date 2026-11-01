import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import type { TravelerDetailsInput } from "../services/traveler-details";

export async function getTravelerProfileState(
  database: AppDatabase,
  tripId: string,
  userId: string,
) {
  const [membership] = await database
    .select({
      gender: schema.tripMemberships.gender,
      roomId: schema.roomAssignments.roomId,
    })
    .from(schema.tripMemberships)
    .leftJoin(
      schema.roomAssignments,
      and(
        eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
        eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
      ),
    )
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, userId),
      ),
    )
    .limit(1);
  return membership ?? null;
}

export async function saveTravelerProfile(
  database: AppDatabase,
  tripId: string,
  userId: string,
  profile: {
    firstName: string;
    lastName: string;
    gender: "M" | "F";
    dietaryRequirements: string;
    allergens: string;
    emergencyContactFirstName: string;
    emergencyContactLastName: string;
    emergencyContactPhone: string;
  },
) {
  const now = new Date();
  await database.transaction(async (transaction) => {
    await transaction
      .update(schema.tripMemberships)
      .set({ gender: profile.gender, genderConfirmed: true })
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      );
    await transaction
      .insert(schema.travelerProfiles)
      .values({
        tripId,
        userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        dietaryRequirements: profile.dietaryRequirements,
        allergens: profile.allergens,
        emergencyContactFirstName: profile.emergencyContactFirstName,
        emergencyContactLastName: profile.emergencyContactLastName,
        emergencyContactPhone: profile.emergencyContactPhone,
        completedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.travelerProfiles.tripId,
          schema.travelerProfiles.userId,
        ],
        set: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          dietaryRequirements: profile.dietaryRequirements,
          allergens: profile.allergens,
          emergencyContactFirstName: profile.emergencyContactFirstName,
          emergencyContactLastName: profile.emergencyContactLastName,
          emergencyContactPhone: profile.emergencyContactPhone,
          completedAt: now,
          updatedAt: now,
        },
      });
  });
}

export async function saveTravelerDetails(
  database: AppDatabase,
  tripId: string,
  userId: string,
  details: TravelerDetailsInput,
) {
  await database
    .insert(schema.travelerDetails)
    .values({ tripId, userId, ...details })
    .onConflictDoUpdate({
      target: [schema.travelerDetails.tripId, schema.travelerDetails.userId],
      set: { ...details, updatedAt: new Date() },
    });
}

export async function getTravelerTransportMode(
  database: AppDatabase,
  tripId: string,
  userId: string,
) {
  const [details] = await database
    .select({ transportMode: schema.travelerDetails.transportMode })
    .from(schema.travelerDetails)
    .where(
      and(
        eq(schema.travelerDetails.tripId, tripId),
        eq(schema.travelerDetails.userId, userId),
      ),
    )
    .limit(1);
  return details?.transportMode ?? null;
}

export async function saveTravelerCarpoolPreferences(
  database: AppDatabase,
  tripId: string,
  userId: string,
  carpoolPreference: boolean,
  parkingPreference: boolean,
) {
  await database
    .update(schema.travelerDetails)
    .set({ carpoolPreference, parkingPreference, updatedAt: new Date() })
    .where(
      and(
        eq(schema.travelerDetails.tripId, tripId),
        eq(schema.travelerDetails.userId, userId),
      ),
    );
}

export async function updateTripName(
  database: AppDatabase,
  tripId: string,
  name: string,
) {
  await database
    .update(schema.trips)
    .set({ name })
    .where(eq(schema.trips.id, tripId));
}
