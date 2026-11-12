import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import * as schema from "../schema";
import { getSession } from "../services/auth/get-session";
export function registerTravelerReadEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/trips/:tripId/traveler", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({
        tripId: schema.trips.id,
        tripName: schema.trips.name,
        userId: schema.tripMemberships.userId,
        firstName: schema.tripMemberships.firstName,
        lastName: schema.tripMemberships.lastName,
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
        role: schema.tripMemberships.role,
        profileFirstName: schema.travelerProfiles.firstName,
        profileLastName: schema.travelerProfiles.lastName,
        dietaryRequirements: schema.travelerProfiles.dietaryRequirements,
        allergens: schema.travelerProfiles.allergens,
        emergencyContactFirstName:
          schema.travelerProfiles.emergencyContactFirstName,
        emergencyContactLastName:
          schema.travelerProfiles.emergencyContactLastName,
        emergencyContactPhone: schema.travelerProfiles.emergencyContactPhone,
        profileCompletedAt: schema.travelerProfiles.completedAt,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.trips,
        eq(schema.tripMemberships.tripId, schema.trips.id),
      )
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
        ),
      )
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);

    const [details] = await services.database
      .select({
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
        updatedAt: schema.travelerDetails.updatedAt,
      })
      .from(schema.travelerDetails)
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, session.user.id),
        ),
      )
      .limit(1);
    const tickets = await services.database
      .select({
        id: schema.transportTickets.id,
        kind: schema.transportTickets.kind,
        originalName: schema.transportTickets.originalName,
        size: schema.transportTickets.size,
        createdAt: schema.transportTickets.createdAt,
      })
      .from(schema.transportTickets)
      .where(
        and(
          eq(schema.transportTickets.tripId, tripId),
          eq(schema.transportTickets.userId, session.user.id),
        ),
      )
      .orderBy(schema.transportTickets.createdAt);

    return context.json({
      trip: { id: membership.tripId, name: membership.tripName },
      traveler: {
        firstName: membership.profileFirstName ?? membership.firstName,
        lastName: membership.profileLastName ?? membership.lastName,
        gender: membership.gender,
        genderConfirmed: membership.genderConfirmed,
        role: membership.role,
      },
      profile: {
        dietaryRequirements: membership.dietaryRequirements,
        allergens: membership.allergens,
        emergencyContactFirstName: membership.emergencyContactFirstName,
        emergencyContactLastName: membership.emergencyContactLastName,
        emergencyContactPhone: membership.emergencyContactPhone,
        completed:
          membership.genderConfirmed && Boolean(membership.profileCompletedAt),
      },
      details: details ?? null,
      tickets,
    });
  });
}
