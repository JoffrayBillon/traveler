import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { listRoomRequestsForMember } from "../datamodel/room-request.repository";
import { getSession } from "../services/auth/get-session";

export function registerRoomRequestReadEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/trips/:tripId/room-requests", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const result = await listRoomRequestsForMember(
      services.database,
      context.req.param("tripId"),
      session.user.id,
      "pending",
    );
    if (!result) return context.json({ error: "not_found" }, 404);
    return context.json(result);
  });
}
