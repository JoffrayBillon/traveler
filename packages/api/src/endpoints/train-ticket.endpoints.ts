import { randomUUID } from "node:crypto";
import type { Context, Hono } from "hono";
import { z } from "zod";
import type { AuthServices } from "../auth";
import { createTrainTicketBlobPath } from "../blob-path";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import { getSession } from "../services/auth/get-session";
import { deleteQueuedTicketBlobs } from "../services/tickets/delete-queued-ticket-blobs";
import {
  addTrainTicketDocument,
  canManageTrainTickets,
  getTrainTicketPool,
  normalizeTrainSeatLabel,
  publishTrainTicketPool,
  removeTrainTicketDocument,
  TrainTicketPoolError,
} from "../services/tickets/train-ticket-pool";
import { uploadPrivateTicket } from "../services/tickets/upload-private-ticket";

const basePath = "/api/trips/:tripId/train-tickets/:segmentId";
const seatLabels = z.array(z.string().trim().min(1).max(80)).min(1).max(500);
const publication = z.object({ snapshot: z.string().regex(/^[a-f0-9]{64}$/) });

export function registerTrainTicketEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  storage: TicketBlobStorage,
  storageAvailable: () => boolean,
) {
  async function authorize(context: Context) {
    context.header("Cache-Control", "private, no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const segmentId = context.req.param("segmentId");
    if (!tripId || !segmentId) return context.json({ error: "not_found" }, 404);
    if (
      !(await canManageTrainTickets(services.database, tripId, session.user.id))
    )
      return context.json({ error: "not_found" }, 404);
    return {
      database: services.database,
      tripId,
      segmentId,
      actorId: session.user.id,
    };
  }

  app.get(basePath, async (context) => {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    const pool = await getTrainTicketPool(
      access.database,
      access.tripId,
      access.segmentId,
    );
    return pool
      ? context.json(pool.view)
      : context.json({ error: "not_found" }, 404);
  });

  app.post(`${basePath}/documents`, async (context) => {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    if (!storageAvailable())
      return context.json({ error: "ticket_storage_unavailable" }, 503);
    const form = await context.req.formData().catch(() => null);
    const file = form?.get("file");
    const places = form?.get("seats");
    const labels = seatLabels.safeParse(
      typeof places === "string"
        ? places
            .split(/\r?\n/)
            .map((label) => label.trim())
            .filter(Boolean)
        : null,
    );
    if (!(file instanceof File) || !labels.success)
      return context.json({ error: "invalid_train_ticket_upload" }, 400);
    if (file.size > 4 * 1024 * 1024)
      return context.json({ error: "file_size_not_allowed" }, 413);
    if (
      file.type !== "application/pdf" ||
      (await file.slice(0, 5).text()) !== "%PDF-"
    )
      return context.json({ error: "file_type_not_allowed" }, 415);
    if (
      new Set(labels.data.map(normalizeTrainSeatLabel)).size !==
      labels.data.length
    )
      return context.json({ error: "duplicate_train_seat" }, 409);
    const { database, tripId, segmentId, actorId } = access;
    const id = randomUUID();
    const blobPath = createTrainTicketBlobPath(tripId, id);
    try {
      await uploadPrivateTicket(
        database,
        storage,
        blobPath,
        file,
        async (transaction) => {
          if (!(await canManageTrainTickets(transaction, tripId, actorId)))
            throw new TrainTicketPoolError("train_segment_unavailable");
          await addTrainTicketDocument(transaction, {
            id,
            tripId,
            segmentId,
            blobPath,
            originalName: file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180),
            size: file.size,
            labels: labels.data,
          });
        },
      );
    } catch (error) {
      if (error instanceof TrainTicketPoolError)
        return context.json({ error: error.code }, 409);
      return context.json({ error: "ticket_upload_failed" }, 503);
    }
    return context.json({ documentId: id }, 201);
  });

  app.post(`${basePath}/publish`, async (context) => {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    const payload = publication.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!payload.success)
      return context.json({ error: "invalid_train_ticket_publication" }, 400);
    const { database, tripId, segmentId, actorId } = access;
    const result = await publishTrainTicketPool(
      database,
      tripId,
      segmentId,
      payload.data.snapshot,
      actorId,
    );
    if (result === "unavailable")
      return context.json({ error: "not_found" }, 404);
    if (result === "stale")
      return context.json({ error: "train_ticket_pool_changed" }, 409);
    return context.json({ status: "published" });
  });

  app.delete(`${basePath}/documents/:documentId`, async (context) => {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    const { database, tripId, segmentId, actorId } = access;
    const path = await removeTrainTicketDocument(
      database,
      tripId,
      segmentId,
      context.req.param("documentId"),
      actorId,
    );
    if (!path) return context.json({ error: "not_found" }, 404);
    await deleteQueuedTicketBlobs(database, storage, [path]);
    return context.json({ status: "deleted" });
  });
}
