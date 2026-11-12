import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { handleMagicLinkRequest } from "../services/auth/magic-link-request";

export function registerAuthEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.all("/api/auth/*", async (context) => {
    const services = getAuthServices();
    if (!services) {
      context.header("Cache-Control", "no-store");
      return context.json({ error: "service_unavailable" }, 503);
    }
    if (
      context.req.method === "POST" &&
      context.req.path === "/api/auth/sign-in/magic-link"
    ) {
      return handleMagicLinkRequest(services, context.req.raw);
    }
    return services.auth.handler(context.req.raw);
  });
}
