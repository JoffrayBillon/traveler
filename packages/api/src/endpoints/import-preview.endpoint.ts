import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  type ImportSourceType,
  isImportSourceType,
} from "../services/imports/import-source";
import { previewImportSource } from "../services/imports/preview-import";

export function registerImportPreviewEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/imports/preview", async (context) => {
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
    if (membership.role !== "manager")
      return context.json({ error: "forbidden" }, 403);

    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_import_file" }, 400);
    }
    const file = form.get("file");
    const sourceType = form.get("sourceType");
    if (!isImportSourceType(sourceType))
      return context.json({ error: "invalid_import_source" }, 400);
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx"))
      return context.json({ error: "xlsx_file_required" }, 400);
    if (file.size < 1 || file.size > 4 * 1024 * 1024)
      return context.json({ error: "import_file_size_not_allowed" }, 413);

    const preview = await previewImportSource(
      services.database,
      tripId,
      session.user.id,
      sourceType as ImportSourceType,
      await file.arrayBuffer(),
    );
    if ("errors" in preview) return context.json(preview, 422);
    return context.json(preview);
  });
}
