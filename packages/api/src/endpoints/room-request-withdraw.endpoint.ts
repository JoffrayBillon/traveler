import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import { RoomingError } from "../services/rooming/model";
import { createRoomingService } from "../services/rooming/rooming-service";

export function registerRoomRequestWithdrawEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.delete("/api/trips/:tripId/room-requests/:requestId", async (context) => {
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
    try {
      const result = await createRoomingService(
        services.database,
      ).withdrawRequest(
        tripId,
        context.req.param("requestId"),
        session.user.id,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof RoomingError)
        return context.json(
          { error: error.code },
          error.code === "request_not_found"
            ? 404
            : error.code === "withdrawal_not_allowed"
              ? 403
              : 409,
        );
      return context.json({ error: "room_request_withdrawal_failed" }, 503);
    }
  });
}
