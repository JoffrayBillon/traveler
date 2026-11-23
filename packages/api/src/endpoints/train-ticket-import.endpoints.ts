import type { Context, Hono } from "hono";
import { z } from "zod";
import { findTrainTicketImport } from "../datamodel/train-tickets.repository";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import { deleteQueuedTicketBlobs } from "../services/tickets/delete-queued-ticket-blobs";
import {
  maxTrainTicketPdfBytes,
  readTrainTicketPages,
} from "../services/tickets/read-train-ticket-pages";
import {
  getTrainImportItem,
  getTrainTicketImport,
  publishTrainTicketImport,
  type TrainTicketImportAccess,
  TrainTicketImportError,
  updateTrainImportItem,
  uploadTrainTicketImport,
} from "../services/tickets/train-ticket-import";
import {
  removeTrainTicketDocument,
  TrainTicketPoolError,
} from "../services/tickets/train-ticket-pool";

const basePath = "/api/trips/:tripId/train-tickets/:segmentId/imports";
const snapshotSchema = z.object({
  snapshot: z.string().regex(/^[a-f0-9]{64}$/),
});
const decisionSchema = z.object({
  kind: z.enum(["named", "transferable", "collective", "ignored", "detected"]),
  userIds: z
    .array(z.string().min(1).max(128))
    .max(500)
    .refine((ids) => ids.length === new Set(ids).size)
    .optional(),
  ticketNumber: z.string().trim().min(1).max(80).optional(),
  carriage: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]{1,12}$/)
    .optional(),
  seat: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]{1,12}$/)
    .optional(),
  capacity: z.number().int().min(1).max(500).optional(),
});

export function registerTrainTicketImportEndpoints(
  app: Hono,
  authorize: (context: Context) => Promise<TrainTicketImportAccess | Response>,
  storage: TicketBlobStorage,
  storageAvailable: () => boolean,
) {
  async function request(
    context: Context,
    action: (access: TrainTicketImportAccess) => Promise<Response>,
  ) {
    const access = await authorize(context);
    if (access instanceof Response) return access;
    try {
      return await action(access);
    } catch (error) {
      if (error instanceof TrainTicketPoolError) {
        return context.json({ error: "train_import_conflict" }, 409);
      }
      if (error instanceof TrainTicketImportError) {
        const status =
          error.code === "not_found"
            ? 404
            : error.code === "invalid_train_import_pdf"
              ? 422
              : 409;
        return context.json({ error: error.code }, status);
      }
      console.error("Train ticket import request failed.");
      return context.json({ error: "train_ticket_import_unavailable" }, 503);
    }
  }

  app.get(basePath, (context) =>
    request(context, async (access) =>
      context.json(await getTrainTicketImport(access)),
    ),
  );

  app.post(`${basePath}/documents`, (context) =>
    request(context, async (access) => {
      if (!storageAvailable())
        return context.json({ error: "ticket_storage_unavailable" }, 503);
      const form = await context.req.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File))
        return context.json({ error: "invalid_train_import_pdf" }, 400);
      if (!file.size || file.size > maxTrainTicketPdfBytes)
        return context.json({ error: "file_size_not_allowed" }, 413);
      if ((await file.slice(0, 5).text()) !== "%PDF-")
        return context.json({ error: "invalid_train_import_pdf" }, 415);
      const pdf = new File([file], file.name, { type: "application/pdf" });
      const result = await uploadTrainTicketImport(access, storage, pdf);
      return context.json(result, result.duplicate ? 200 : 201);
    }),
  );

  app.patch(`${basePath}/items/:itemId`, (context) =>
    request(context, async (access) => {
      const payload = decisionSchema.safeParse(
        await context.req.json().catch(() => null),
      );
      if (!payload.success)
        return context.json({ error: "invalid_train_import_decision" }, 400);
      const { kind, ...fields } = payload.data;
      await updateTrainImportItem(
        access,
        context.req.param("itemId"),
        kind === "detected" ? { kind } : { kind, ...fields },
      );
      return context.json({ status: "saved" });
    }),
  );

  app.get(`${basePath}/items/:itemId/pdf`, (context) =>
    request(context, async (access) => {
      const { document, item } = await getTrainImportItem(
        access,
        context.req.param("itemId"),
      );
      const blob = await storage.get(document.blobPath, { access: "private" });
      if (blob?.statusCode !== 200 || !blob.stream)
        return context.json({ error: "not_found" }, 404);
      return new Response(await readTrainTicketPages(blob.stream, item.pages), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="train-ticket-preview.pdf"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }),
  );

  app.get(`${basePath}/documents/:documentId/pdf`, (context) =>
    request(context, async ({ database, tripId, segmentId }) => {
      const [document] = await findTrainTicketImport(
        database,
        tripId,
        segmentId,
        context.req.param("documentId"),
      );
      if (!document) return context.json({ error: "not_found" }, 404);
      const blob = await storage.get(document.blobPath, { access: "private" });
      if (blob?.statusCode !== 200 || !blob.stream)
        return context.json({ error: "not_found" }, 404);
      return new Response(blob.stream, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }),
  );

  app.post(`${basePath}/publish`, (context) =>
    request(context, async (access) => {
      const payload = snapshotSchema.safeParse(
        await context.req.json().catch(() => null),
      );
      if (!payload.success)
        return context.json({ error: "invalid_train_ticket_publication" }, 400);
      await publishTrainTicketImport(access, payload.data.snapshot);
      return context.json({ status: "published" });
    }),
  );

  app.delete(`${basePath}/documents/:documentId`, (context) =>
    request(context, async (access) => {
      const path = await removeTrainTicketDocument(
        access.database,
        access.tripId,
        access.segmentId,
        context.req.param("documentId"),
        access.actorId,
        context.req.query("confirmPublished") === "true"
          ? "importConfirmed"
          : "importDraft",
      );
      if (!path) return context.json({ error: "not_found" }, 404);
      await deleteQueuedTicketBlobs(access.database, storage, [path]);
      return context.json({ status: "deleted" });
    }),
  );
}
