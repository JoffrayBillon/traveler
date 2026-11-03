import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripTransportView } from "../datamodel/transport.repository";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import { saveCarpoolRoleService } from "../services/transport/transport-service";

export function registerTransportReadEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/trips/:tripId/transport", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const member = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!member) return context.json({ error: "not_found" }, 404);
    const result = await getTripTransportView(
      services.database,
      tripId,
      session.user.id,
      member.role !== "traveler",
    );
    return context.json(result);
  });

  app.patch("/api/trips/:tripId/carpool-role", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const member = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!member) return context.json({ error: "not_found" }, 404);
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_carpool_role" }, 400);
    }
    const result = await saveCarpoolRoleService(
      services.database,
      tripId,
      session.user.id,
      payload,
    );
    if ("error" in result)
      return context.json(
        { error: result.error },
        result.error === "traveler_not_found"
          ? 403
          : result.error === "carpool_requires_no_transport"
            ? 409
            : 400,
      );
    return context.json(result);
  });
}
