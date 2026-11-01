import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

export async function findTripMemberRole(
  database: AppDatabase,
  tripId: string,
  userId: string,
) {
  const [membership] = await database
    .select({ role: schema.tripMemberships.role })
    .from(schema.tripMemberships)
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, userId),
      ),
    )
    .limit(1);
  return membership?.role ?? null;
}

export function listTripTravelerRows(database: AppDatabase, tripId: string) {
  return database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
      lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
      gender: schema.tripMemberships.gender,
      genderConfirmed: schema.tripMemberships.genderConfirmed,
      email: schema.users.email,
      role: schema.tripMemberships.role,
      lastLoginAt: schema.tripMemberships.lastLoginAt,
      dietaryRequirements: schema.travelerProfiles.dietaryRequirements,
      allergens: schema.travelerProfiles.allergens,
      profileCompletedAt: schema.travelerProfiles.completedAt,
      emergencyContactFirstName:
        schema.travelerProfiles.emergencyContactFirstName,
      emergencyContactLastName:
        schema.travelerProfiles.emergencyContactLastName,
      emergencyContactPhone: schema.travelerProfiles.emergencyContactPhone,
      activityProfile: schema.travelerDetails.activityProfile,
      skiDayThree: schema.travelerDetails.skiDayThree,
      transportMode: schema.travelerDetails.transportMode,
      departureCity: schema.travelerDetails.departureCity,
      outboundDateTime: schema.travelerDetails.outboundDateTime,
      outboundTimezone: schema.travelerDetails.outboundTimezone,
      outboundMeetingTime: schema.travelerDetails.outboundMeetingTime,
      outboundDepartureTime: schema.travelerDetails.outboundDepartureTime,
      outboundLocation: schema.travelerDetails.outboundLocation,
      outboundReference: schema.travelerDetails.outboundReference,
      outboundSeat: schema.travelerDetails.outboundSeat,
      returnDateTime: schema.travelerDetails.returnDateTime,
      returnTimezone: schema.travelerDetails.returnTimezone,
      returnMeetingTime: schema.travelerDetails.returnMeetingTime,
      returnDepartureTime: schema.travelerDetails.returnDepartureTime,
      returnLocation: schema.travelerDetails.returnLocation,
      returnReference: schema.travelerDetails.returnReference,
      returnSeat: schema.travelerDetails.returnSeat,
      carpoolPreference: schema.travelerDetails.carpoolPreference,
      parkingPreference: schema.travelerDetails.parkingPreference,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .leftJoin(
      schema.travelerDetails,
      and(
        eq(schema.tripMemberships.tripId, schema.travelerDetails.tripId),
        eq(schema.tripMemberships.userId, schema.travelerDetails.userId),
      ),
    )
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.tripMemberships.tripId, schema.travelerProfiles.tripId),
        eq(schema.tripMemberships.userId, schema.travelerProfiles.userId),
      ),
    )
    .where(eq(schema.tripMemberships.tripId, tripId))
    .orderBy(schema.tripMemberships.lastName, schema.tripMemberships.firstName);
}

export function listParticipantAccessRows(
  database: AppDatabase,
  tripId: string,
) {
  return database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: schema.tripMemberships.firstName,
      lastName: schema.tripMemberships.lastName,
      email: schema.users.email,
      role: schema.tripMemberships.role,
      lastLoginAt: schema.tripMemberships.lastLoginAt,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .where(eq(schema.tripMemberships.tripId, tripId))
    .orderBy(schema.tripMemberships.lastName, schema.tripMemberships.firstName);
}

export function listValidatedRegistrationPayments(
  database: AppDatabase,
  tripId: string,
) {
  return database
    .select({
      userId: schema.tripRegistrations.userId,
      paymentStatus: schema.tripRegistrations.paymentStatus,
      amountPaidMinor: schema.tripRegistrations.amountPaidMinor,
      amountDueMinor: schema.tripRegistrations.amountDueMinor,
    })
    .from(schema.tripRegistrations)
    .where(
      and(
        eq(schema.tripRegistrations.tripId, tripId),
        eq(schema.tripRegistrations.status, "validated"),
      ),
    );
}
