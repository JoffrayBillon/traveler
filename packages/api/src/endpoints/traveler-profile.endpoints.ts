import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  completeTravelerProfile,
  renameTrip,
} from "../services/traveler-details";

export function registerTravelerProfileEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.put("/api/trips/:tripId/profile", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_profile" }, 400);
    }
    const result = await completeTravelerProfile(
      services.database,
      context.req.param("tripId"),
      session.user.id,
      body,
    );
    if (!result.ok)
      return context.json(
        { error: result.error },
        result.error === "not_found"
          ? 404
          : result.error === "gender_locked"
            ? 409
            : 400,
      );
    return context.json({ status: "saved" });
  });

  app.put("/api/trips/:tripId", async (context) => {
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
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_trip" }, 400);
    }
    const nameValue =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).name
        : undefined;
    const result = await renameTrip(services.database, tripId, nameValue);
    if (!result.ok) return context.json({ error: result.error }, 400);
    return context.json({ status: "saved", name: result.name });
  });
}
