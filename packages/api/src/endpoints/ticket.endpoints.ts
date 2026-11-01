import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { createTicketBlobPath } from "../blob-path";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import * as schema from "../schema";
import { getSession } from "../services/auth/get-session";

export function registerTicketEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  ticketStorage: TicketBlobStorage,
  ticketStorageAvailable: () => boolean,
) {
  app.post("/api/trips/:tripId/travelers/:userId/tickets", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const targetUserId = context.req.param("userId");
    const [actor] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role === "traveler")
      return context.json({ error: "forbidden" }, 403);
    const [target] = await services.database
      .select({ userId: schema.tripMemberships.userId })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, targetUserId),
        ),
      )
      .limit(1);
    if (!target) return context.json({ error: "not_found" }, 404);

    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_upload" }, 400);
    }
    const file = form.get("file");
    const kind = form.get("kind");
    if (
      !(file instanceof File) ||
      !(kind === "outbound" || kind === "return" || kind === "other")
    ) {
      return context.json({ error: "invalid_upload" }, 400);
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      return context.json({ error: "file_size_not_allowed" }, 413);
    }
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
    ]);
    if (!allowedTypes.has(file.type))
      return context.json({ error: "file_type_not_allowed" }, 415);
    if (!ticketStorageAvailable()) {
      return context.json({ error: "ticket_storage_unavailable" }, 503);
    }

    const id = randomUUID();
    const blobPath = createTicketBlobPath(tripId, targetUserId, id);
    let blobCreated = false;
    try {
      await ticketStorage.put(blobPath, file, {
        access: "private",
        contentType: file.type,
        addRandomSuffix: false,
      });
      blobCreated = true;
      await services.database.insert(schema.transportTickets).values({
        id,
        tripId,
        userId: targetUserId,
        kind,
        blobPath,
        originalName: file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180),
        contentType: file.type,
        size: file.size,
        uploadedBy: session.user.id,
      });
    } catch {
      if (blobCreated) await ticketStorage.del(blobPath).catch(() => undefined);
      return context.json({ error: "ticket_upload_failed" }, 503);
    }
    return context.json({ status: "uploaded", ticketId: id }, 201);
  });

  app.get("/api/trips/:tripId/tickets/:ticketId", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const [membership] = await services.database
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!membership) return context.json({ error: "not_found" }, 404);
    const [ticket] = await services.database
      .select()
      .from(schema.transportTickets)
      .where(
        and(
          eq(schema.transportTickets.tripId, tripId),
          eq(schema.transportTickets.id, context.req.param("ticketId")),
        ),
      )
      .limit(1);
    if (!ticket) return context.json({ error: "not_found" }, 404);
    if (ticket.userId !== session.user.id && membership.role === "traveler") {
      return context.json({ error: "not_found" }, 404);
    }
    try {
      const blob = await ticketStorage.get(ticket.blobPath, {
        access: "private",
      });
      if (blob?.statusCode !== 200 || !blob.stream)
        return context.json({ error: "not_found" }, 404);
      return new Response(blob.stream, {
        headers: {
          "Content-Type": ticket.contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ticket.originalName)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return context.json({ error: "ticket_storage_unavailable" }, 503);
    }
  });
}
