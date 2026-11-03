import { and, eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import * as schema from "../schema";
import { getSession } from "../services/auth/get-session";
import { listUserTrips } from "../services/trips/list-user-trips";

export function registerIdentityEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/me", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const memberships = await listUserTrips(services.database, session.user.id);
    if (memberships.length === 0)
      return context.json({ error: "forbidden" }, 403);

    const [identity] = await services.database
      .select({
        firstName: sql<
          string | null
        >`coalesce(nullif(${schema.travelerProfiles.firstName}, ''), ${schema.tripMemberships.firstName})`,
        lastName: sql<
          string | null
        >`coalesce(nullif(${schema.travelerProfiles.lastName}, ''), ${schema.tripMemberships.lastName})`,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.trips,
        eq(schema.trips.id, schema.tripMemberships.tripId),
      )
      .leftJoin(
        schema.travelerProfiles,
        and(
          eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
          eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
        ),
      )
      .where(eq(schema.tripMemberships.userId, session.user.id))
      .orderBy(schema.trips.name, schema.trips.id)
      .limit(1);
    const displayName = [identity?.firstName, identity?.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ");

    return context.json({
      user: {
        id: session.user.id,
        name: displayName || session.user.name,
        email: session.user.email,
      },
      trips: memberships,
    });
  });
}
