import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { findTripMemberRole } from "../datamodel/staff-directory.repository";
import { getSession } from "../services/auth/get-session";
import {
  listParticipantAccess,
  listStaffTravelers,
} from "../services/staff-directory";

export function registerStaffReadEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/trips/:tripId/travelers", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const actorRole = await findTripMemberRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!actorRole) return context.json({ error: "not_found" }, 404);
    if (actorRole === "traveler")
      return context.json({ error: "forbidden" }, 403);

    return context.json({
      travelers: await listStaffTravelers(services.database, tripId, actorRole),
    });
  });

  app.get("/api/trips/:tripId/participants/access", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const actorRole = await findTripMemberRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!actorRole) return context.json({ error: "not_found" }, 404);
    if (actorRole !== "manager")
      return context.json({ error: "forbidden" }, 403);

    return context.json({
      participants: await listParticipantAccess(services.database, tripId),
    });
  });
}
