import { timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import type { TicketBlobStorage } from "../ports/ticket-storage";
import { purgeExpiredTrips } from "../services/purge-expired-trips";

export function registerTripRetentionEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  storage: TicketBlobStorage,
  environment: NodeJS.ProcessEnv = process.env,
) {
  app.get("/api/cron/purge-expired-trips", async (context) => {
    context.header("Cache-Control", "no-store");
    const secret = environment.CRON_SECRET;
    const authorization = context.req.header("Authorization") ?? "";
    if (!secret || !isAuthorized(authorization, secret)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    try {
      const result = await purgeExpiredTrips(services.database, storage);
      return context.json(result, result.failed ? 503 : 200);
    } catch {
      console.error("Trip retention job failed.");
      return context.json({ error: "retention_unavailable" }, 503);
    }
  });
}

function isAuthorized(header: string, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
