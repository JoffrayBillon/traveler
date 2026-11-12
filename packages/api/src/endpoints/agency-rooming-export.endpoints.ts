import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import { prepareAgencyRoomingTemplate } from "../services/imports/prepare-agency-rooming-template";

export function registerAgencyRoomingExportEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/rooms/agency-export", async (context) => {
    context.header("Cache-Control", "private, no-store");
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

    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_rooming_template" }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx"))
      return context.json({ error: "xlsx_file_required" }, 400);
    if (file.size < 1 || file.size > 4 * 1024 * 1024)
      return context.json({ error: "import_file_size_not_allowed" }, 413);

    const result = await prepareAgencyRoomingTemplate(
      services.database,
      tripId,
      await file.arrayBuffer(),
    );
    if (!result.ok) {
      const { error, status, ...details } = result;
      return context.json({ error, ...details }, status);
    }
    context.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    context.header(
      "Content-Disposition",
      "attachment; filename=traveler-rooming-agence.xlsx",
    );
    return context.body(new Uint8Array(result.workbook));
  });
}
