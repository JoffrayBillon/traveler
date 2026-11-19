import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import {
  confirmMagicLink,
  magicLinkConfirmationSchema,
  previewMagicLink,
} from "../services/auth/magic-link-confirmation";
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
    const path = context.req.path.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
    const isVerification = path === "/api/auth/magic-link/verify";
    const isPreview = path === "/api/auth/magic-link/preview";
    if (isVerification || isPreview) {
      context.header("Cache-Control", "private, no-store");
      context.header("Referrer-Policy", "no-referrer");
      context.header("X-Robots-Tag", "noindex, nofollow, noarchive");
      if (isVerification && ["GET", "HEAD"].includes(context.req.method)) {
        return context.redirect(
          `/sign-in/confirm#${new URL(context.req.url).searchParams.toString()}`,
          302,
        );
      }
      if (context.req.method !== "POST")
        return context.json({ error: "method_not_allowed" }, 405);
      const origin = context.req.header("origin");
      const authContext = await services.auth.$context;
      if (!origin || !authContext.isTrustedOrigin(origin)) {
        return context.json({ error: "forbidden" }, 403);
      }
      const body = isPreview
        ? await context.req.json().catch(() => null)
        : await context.req.parseBody().catch(() => null);
      const input = magicLinkConfirmationSchema.safeParse(body);
      if (!input.success) return context.json({ error: "invalid_token" }, 400);
      if (isPreview) {
        const identity = await previewMagicLink(services, input.data.token);
        return identity
          ? context.json(identity)
          : context.json({ error: "invalid_token" }, 410);
      }
      const response = await confirmMagicLink(
        services,
        context.req.raw,
        input.data,
      );
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "private, no-store");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    if (
      context.req.method === "POST" &&
      path === "/api/auth/sign-in/magic-link"
    ) {
      context.header("Cache-Control", "no-store");
      if (new URL(context.req.url).pathname !== path) {
        return context.json({ error: "not_found" }, 404);
      }
      const origin = context.req.header("Origin");
      if (origin && !(await services.auth.$context).isTrustedOrigin(origin)) {
        return context.json({ error: "forbidden" }, 403);
      }
      return handleMagicLinkRequest(services, context.req.raw);
    }
    return services.auth.handler(context.req.raw);
  });
}
