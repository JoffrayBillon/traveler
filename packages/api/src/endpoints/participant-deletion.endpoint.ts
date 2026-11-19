import type { Hono } from "hono";
import { z } from "zod";
import type { AuthServices } from "../auth";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import { getSession } from "../services/auth/get-session";
import { deleteParticipant } from "../services/delete-participant";
import { deleteQueuedTicketBlobs } from "../services/tickets/delete-queued-ticket-blobs";

const confirmationSchema = z.object({
  email: z.string().trim().min(1).max(320),
});

export function registerParticipantDeletionEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  ticketStorage: TicketBlobStorage,
) {
  app.delete("/api/trips/:tripId/participants/:userId", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const contentType = context.req
      .header("Content-Type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      return context.json({ error: "invalid_participant_confirmation" }, 400);
    }
    const payload: unknown = await context.req.json().catch(() => null);
    const confirmation = confirmationSchema.safeParse(payload);
    if (!confirmation.success) {
      return context.json({ error: "invalid_participant_confirmation" }, 400);
    }
    const result = await deleteParticipant(
      services.database,
      context.req.param("tripId"),
      session.user.id,
      context.req.param("userId"),
      confirmation.data.email,
    );
    if ("error" in result) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "forbidden"
            ? 403
            : 409;
      return context.json({ error: result.error }, status);
    }
    if (result.blobPaths.length) {
      services.scheduleBackgroundTask(
        deleteQueuedTicketBlobs(
          services.database,
          ticketStorage,
          result.blobPaths,
        ),
      );
    }
    return context.json({ status: result.status });
  });
}
