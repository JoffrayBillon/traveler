import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  assignInitialRoom,
  createRoom,
} from "../services/rooming/room-management-service";

export function registerRoomManagementEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/rooms", async (context) => {
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

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_room" }, 400);
    }
    if (!body || typeof body !== "object")
      return context.json({ error: "invalid_room" }, 400);
    const { name, capacity } = body as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 12
    )
      return context.json({ error: "invalid_room" }, 400);

    const result = await createRoom(services.database, tripId, name, capacity);
    if ("error" in result) return context.json({ error: result.error }, 409);
    return context.json(result, 201);
  });

  app.post(
    "/api/trips/:tripId/rooms/:roomId/initial-assignment",
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

      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "invalid_assignment" }, 400);
      }
      const userId =
        body && typeof body === "object"
          ? (body as Record<string, unknown>).userId
          : undefined;
      if (typeof userId !== "string" || !userId)
        return context.json({ error: "invalid_assignment" }, 400);

      const result = await assignInitialRoom(
        services.database,
        tripId,
        context.req.param("roomId"),
        userId,
      );
      if (result.error === "not_found")
        return context.json({ error: result.error }, 404);
      if (
        result.error === "room_change_requires_consents" ||
        result.error === "room_capacity_exceeded"
      )
        return context.json({ error: result.error }, 409);
      if (result.error === "already_assigned")
        return context.json({ status: result.error });
      return context.json({ status: "assigned" }, 201);
    },
  );
}
