import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

export async function listTripMembershipsForUser(
  database: AppDatabase,
  userId: string,
) {
  const memberships = await database
    .select({
      tripId: schema.trips.id,
      tripName: schema.trips.name,
      endsOn: schema.trips.endsOn,
      role: schema.tripMemberships.role,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.trips, eq(schema.tripMemberships.tripId, schema.trips.id))
    .where(eq(schema.tripMemberships.userId, userId))
    .orderBy(schema.trips.name, schema.trips.id);
  return memberships.map(({ endsOn, ...membership }) =>
    endsOn ? { ...membership, endsOn } : membership,
  );
}

export async function getTripMembershipRole(
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
  return membership ?? null;
}
