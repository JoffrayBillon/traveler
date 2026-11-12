import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import { RoomingError } from "../services/rooming/model";
import { createRoomingService } from "../services/rooming/rooming-service";

export function registerRoomRequestConsentEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post(
    "/api/trips/:tripId/room-requests/:requestId/consent",
    async (context) => {
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
        return context.json({ error: "invalid_consent" }, 400);
      }
      const approve =
        body && typeof body === "object"
          ? (body as Record<string, unknown>).approve
          : undefined;
      if (typeof approve !== "boolean")
        return context.json({ error: "invalid_consent" }, 400);
      try {
        const result = await createRoomingService(services.database).consent(
          tripId,
          context.req.param("requestId"),
          session.user.id,
          approve,
        );
        return context.json(result);
      } catch (error) {
        if (error instanceof RoomingError)
          return context.json(
            { error: error.code },
            error.code === "request_not_found" ? 404 : 409,
          );
        return context.json({ error: "room_consent_failed" }, 503);
      }
    },
  );
}
