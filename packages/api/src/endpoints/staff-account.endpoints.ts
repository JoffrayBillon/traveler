import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { isTrustedAuthOrigin } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import { getSession } from "../services/auth/get-session";
import { handleMagicLinkRequest } from "../services/auth/magic-link-request";
import { updateParticipantEmail } from "../services/participant-management";

export function registerStaffAccountEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
  authEnvironment: NodeJS.ProcessEnv,
) {
  app.put("/api/trips/:tripId/participants/:userId/email", async (context) => {
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
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_email" }, 400);
    }
    const rawEmail =
      body && typeof body === "object" && "email" in body
        ? (body as { email?: unknown }).email
        : undefined;
    if (typeof rawEmail !== "string")
      return context.json({ error: "invalid_email" }, 400);
    const email = normalizeEmail(rawEmail);
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return context.json({ error: "invalid_email" }, 400);
    }
    const result = await updateParticipantEmail(
      services.database,
      tripId,
      targetUserId,
      email,
    );
    if (result.status === "not_found")
      return context.json({ error: "not_found" }, 404);
    if (result.status === "email_in_use")
      return context.json({ error: "email_in_use" }, 409);
    return context.json(result);
  });

  app.post(
    "/api/trips/:tripId/participants/:userId/login-link",
    async (context) => {
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
      if (actor.role !== "manager")
        return context.json({ error: "forbidden" }, 403);
      const [target] = await services.database
        .select({ email: schema.users.email })
        .from(schema.tripMemberships)
        .innerJoin(
          schema.users,
          eq(schema.tripMemberships.userId, schema.users.id),
        )
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, targetUserId),
          ),
        )
        .limit(1);
      if (!target) return context.json({ error: "not_found" }, 404);
      const magicLinkCapture = services.magicLinkCapture;
      if (!magicLinkCapture)
        return context.json({ error: "sign_in_link_generation_failed" }, 503);
      const requestId = randomUUID();
      magicLinkCapture.authorize(requestId);

      const configuredAuthOrigin =
        authEnvironment.BETTER_AUTH_URL?.trim() ||
        (authEnvironment.VERCEL_BRANCH_URL
          ? `https://${authEnvironment.VERCEL_BRANCH_URL.trim()}`
          : authEnvironment.VERCEL_URL
            ? `https://${authEnvironment.VERCEL_URL.trim()}`
            : "http://127.0.0.1:5173");
      const requestOrigin = context.req.header("origin");
      const authOrigin =
        requestOrigin && isTrustedAuthOrigin(requestOrigin, authEnvironment)
          ? new URL(requestOrigin).origin
          : configuredAuthOrigin;
      const response = await handleMagicLinkRequest(
        services,
        new Request(`${authOrigin}/api/auth/sign-in/magic-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: authOrigin },
          body: JSON.stringify({
            email: target.email,
            callbackURL: `/trips/${encodeURIComponent(tripId)}`,
            metadata: { copySignInLinkRequestId: requestId },
          }),
        }),
        { awaitProcessing: true },
      );
      if (response.status === 429) {
        magicLinkCapture.take(requestId);
        return context.json(
          { error: "rate_limited" },
          {
            status: 429,
            headers: {
              "Retry-After":
                response.headers.get("Retry-After") ??
                response.headers.get("X-Retry-After") ??
                "30",
            },
          },
        );
      }
      if (!response.ok) {
        magicLinkCapture.take(requestId);
        return context.json({ error: "sign_in_link_generation_failed" }, 503);
      }
      const link = magicLinkCapture.take(requestId);
      if (!link)
        return context.json({ error: "sign_in_link_generation_failed" }, 503);
      return context.json({ link });
    },
  );
}
