import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  parseTravelerDetails,
  updateCarpoolPreferences,
  updateTravelerDetails,
} from "../services/traveler-details";

export function registerTravelerDetailsEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.put("/api/trips/:tripId/travelers/:userId/details", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const actor = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);
    const target = await getTripMembershipRole(
      services.database,
      tripId,
      context.req.param("userId"),
    );
    if (!target) return context.json({ error: "not_found" }, 404);

    const parsed = await parseTravelerDetails(context.req.raw);
    if (!parsed.ok) return context.json({ error: "invalid_details" }, 400);
    const result = await updateTravelerDetails(
      services.database,
      tripId,
      context.req.param("userId"),
      parsed.value,
    );
    if (!result.ok) return context.json({ error: result.error }, 400);
    return context.json({ status: "saved" });
  });

  app.patch("/api/trips/:tripId/carpool-preferences", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const membership = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!membership) return context.json({ error: "not_found" }, 404);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_preferences" }, 400);
    }
    const result = await updateCarpoolPreferences(
      services.database,
      tripId,
      session.user.id,
      body,
    );
    if (!result.ok)
      return context.json(
        { error: result.error },
        result.error === "carpool_requires_no_transport" ? 409 : 400,
      );
    return context.json({ status: "saved" });
  });
}
