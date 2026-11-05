import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import type { TravelerDetailsInput } from "../services/traveler-details";
import { staleRoomRequestsForRooms } from "./room-request.repository";

export async function getTravelerProfileState(
  database: AppDatabase,
  tripId: string,
  userId: string,
) {
  const [membership] = await database
    .select({
      gender: schema.tripMemberships.gender,
      genderConfirmed: schema.tripMemberships.genderConfirmed,
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
  return database.transaction(async (transaction) => {
    const [membership] = await transaction
      .select({
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
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
    if (!membership) return false;
    if (membership.genderConfirmed && membership.gender !== profile.gender)
      return false;

    const [updatedMembership] = await transaction
      .update(schema.tripMemberships)
      .set({ gender: profile.gender, genderConfirmed: true })
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
          sql`(${schema.tripMemberships.genderConfirmed} = 0 OR ${schema.tripMemberships.gender} = ${profile.gender})`,
        ),
      )
      .returning({ userId: schema.tripMemberships.userId });
    if (!updatedMembership) return false;
    if (membership.roomId && !membership.genderConfirmed)
      await refreshRoomComposition(transaction, tripId, membership.roomId);

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
    return true;
  });
}

export async function refreshRoomComposition(
  transaction: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
  tripId: string,
  roomId: string,
) {
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
  const genders = new Set(
    occupants
      .filter(({ genderConfirmed }) => genderConfirmed)
      .map(({ gender }) => gender)
      .filter((gender): gender is "M" | "F" => gender !== null),
  );
  await transaction
    .update(schema.rooms)
    .set({
      genderPolicy:
        genders.size === 0
          ? "unset"
          : genders.size > 1
            ? "mixed"
            : "single_gender",
      compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
    })
    .where(and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)));
  await staleRoomRequestsForRooms(transaction, tripId, [roomId]);
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
  endsOn?: string | null,
) {
  const values: { name: string; endsOn?: string | null } = { name };
  if (endsOn !== undefined) values.endsOn = endsOn;
  await database
    .update(schema.trips)
    .set(values)
    .where(eq(schema.trips.id, tripId));
}
