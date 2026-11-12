import { createHash, randomUUID } from "node:crypto";
import { eq, lte } from "drizzle-orm";
import type { AuthServices } from "../../auth";
import { normalizeEmail } from "../../email";
import * as schema from "../../schema";

const magicLinkEmailCooldownMs = 30_000;
export async function handleMagicLinkRequest(
  services: AuthServices,
  request: Request,
  options: { awaitProcessing?: boolean } = {},
) {
  const normalized = await normalizeMagicLinkRequest(request);
  if (normalized.email) {
    const retryAfter = await enforceMagicLinkEmailCooldown(
      services,
      normalized.email,
    );
    if (retryAfter !== null) {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
  }

  const processRequest = async () => {
    const response = await services.auth.handler(normalized.request);
    if (response.status >= 500) {
      console.error("Magic link request processing failed.", response.status);
    }
    return response;
  };

  if (options.awaitProcessing) {
    try {
      const response = await processRequest();
      if (response.status === 429) {
        return Response.json(
          { error: "rate_limited" },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After":
                response.headers.get("Retry-After") ??
                response.headers.get("X-Retry-After") ??
                "30",
            },
          },
        );
      }
      if (!response.ok) {
        return Response.json(
          { error: "email_delivery_failed" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch (error) {
      console.error(
        "Magic link request processing failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return Response.json(
        { error: "email_delivery_failed" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { status: "accepted" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  const task = Promise.resolve()
    .then(processRequest)
    .catch((error: unknown) => {
      console.error(
        "Magic link request processing failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
    });
  services.scheduleBackgroundTask(task);

  // Acknowledge before account lookup so membership cannot be inferred by timing.
  return Response.json(
    { status: "accepted" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function normalizeMagicLinkRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return { request };
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    typeof body.email !== "string"
  ) {
    return { request };
  }

  const email = normalizeEmail(body.email);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return {
    email,
    request: new Request(request.url, {
      method: request.method,
      headers,
      body: JSON.stringify({ ...body, email }),
    }),
  };
}

async function enforceMagicLinkEmailCooldown(
  services: AuthServices,
  email: string,
) {
  const now = Date.now();
  const key = `magic-link-email:${createHash("sha256").update(email).digest("hex")}`;
  const accepted = await services.database
    .insert(schema.rateLimits)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: { count: 1, lastRequest: now },
      setWhere: lte(
        schema.rateLimits.lastRequest,
        now - magicLinkEmailCooldownMs,
      ),
    })
    .returning({ id: schema.rateLimits.id });

  if (accepted.length > 0) return null;

  const [existing] = await services.database
    .select({ lastRequest: schema.rateLimits.lastRequest })
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, key))
    .limit(1);
  if (!existing) return Math.ceil(magicLinkEmailCooldownMs / 1000);

  return Math.max(
    1,
    Math.ceil(
      (existing.lastRequest + magicLinkEmailCooldownMs - Date.now()) / 1000,
    ),
  );
}
