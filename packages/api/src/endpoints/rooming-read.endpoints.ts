import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getRoomingView } from "../datamodel/rooming.repository";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import { exportRoomingWorkbook } from "../services/rooming/rooming-export-service";

export function registerRoomingReadEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/trips/:tripId/rooms", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const result = await getRoomingView(
      services.database,
      context.req.param("tripId"),
      session.user.id,
    );
    if (!result) return context.json({ error: "not_found" }, 404);
    return context.json(result);
  });

  app.get("/api/trips/:tripId/rooms/export", async (context) => {
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

    const workbook = await exportRoomingWorkbook(services.database, tripId);
    context.header("Cache-Control", "private, no-store");
    context.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    context.header(
      "Content-Disposition",
      "attachment; filename=traveler-rooming.xlsx",
    );
    return context.body(workbook);
  });
}
