import { timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import { deleteExpiredTickets } from "../services/tickets/delete-expired-tickets";

export function registerTicketRetentionEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  storage: TicketBlobStorage,
  environment: NodeJS.ProcessEnv = process.env,
) {
  app.get("/api/cron/delete-expired-tickets", async (context) => {
    context.header("Cache-Control", "no-store");
    const secret = environment.CRON_SECRET;
    const authorization = context.req.header("Authorization") ?? "";
    if (!secret || !isAuthorized(authorization, secret)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const result = await deleteExpiredTickets(services.database, storage);
    return context.json(result);
  });
}

function isAuthorized(header: string, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
