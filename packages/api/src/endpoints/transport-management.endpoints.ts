import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  deleteTransportGroupService,
  saveTransportGroupService,
  setParticipantTransportService,
} from "../services/transport/transport-service";

export function registerTransportManagementEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/transport-groups", async (context) => {
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
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_group" }, 400);
    }
    const result = await saveTransportGroupService(
      services.database,
      tripId,
      payload,
    );
    if (!result.ok) return context.json({ error: result.error }, 400);
    return context.json(result, 201);
  });

  app.put("/api/trips/:tripId/transport-groups/:groupId", async (context) => {
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
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_group" }, 400);
    }
    const result = await saveTransportGroupService(
      services.database,
      tripId,
      payload,
      context.req.param("groupId"),
    );
    if (!result.ok)
      return context.json(
        { error: result.error },
        result.error === "not_found" ? 404 : 400,
      );
    return context.json(result);
  });

  app.delete(
    "/api/trips/:tripId/transport-groups/:groupId",
    async (context) => {
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
      const result = await deleteTransportGroupService(
        services.database,
        tripId,
        context.req.param("groupId"),
      );
      if ("error" in result)
        return context.json(
          { error: result.error },
          result.error === "not_found" ? 404 : 409,
        );
      return context.json(result);
    },
  );

  app.put(
    "/api/trips/:tripId/participants/:userId/transport",
    async (context) => {
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
      let payload: unknown;
      try {
        payload = await context.req.json();
      } catch {
        return context.json({ error: "invalid_transport_assignment" }, 400);
      }
      const result = await setParticipantTransportService(
        services.database,
        tripId,
        context.req.param("userId"),
        session.user.id,
        payload,
      );
      if ("error" in result)
        return context.json(
          { error: result.error },
          result.error === "traveler_not_found" ||
            result.error === "transport_group_not_found"
            ? 404
            : 400,
        );
      return context.json(result);
    },
  );
}
