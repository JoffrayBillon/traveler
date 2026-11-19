import { getIP } from "better-auth/api";
import { lte } from "drizzle-orm";
import { z } from "zod";
import type { AuthServices } from "../../auth";
import { normalizeEmail } from "../../email";
import { signInRateLimits } from "../../schema";
import { reserveMagicLinkRequest } from "./magic-link-rate-limit";

const signInBody = z
  .object({ email: z.string().trim().max(320).pipe(z.email()) })
  .passthrough();

export async function handleMagicLinkRequest(
  services: AuthServices,
  request: Request,
  copyActorId?: string,
) {
  const contentType = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return Response.json(
      { error: "unsupported_media_type" },
      {
        status: 415,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const raw: unknown = await request.json().catch(() => null);
  const input = signInBody.safeParse(raw);
  if (!input.success)
    return Response.json(
      { error: "invalid_email" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );

  const email = normalizeEmail(input.data.email);
  let retryAfter: number | null;
  try {
    retryAfter = copyActorId
      ? await reserveMagicLinkRequest(
          services.database,
          "manager",
          copyActorId,
          60,
          5,
        )
      : await reserveMagicLinkRequest(
          services.database,
          "network",
          getIP(request, services.auth.options) ?? "local",
          60,
          5,
        );
    if (retryAfter === null && !copyActorId) {
      retryAfter = await reserveMagicLinkRequest(
        services.database,
        "address",
        email,
        300,
        1,
      );
    }
  } catch (error) {
    logRequestFailure(error);
    return unavailable();
  }
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

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("Content-Type", "application/json");
  const normalized = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...input.data, email }),
  });

  if (copyActorId) {
    try {
      const response = await services.auth.handler(normalized);
      if (!response.ok) return unavailable();
    } catch (error) {
      logRequestFailure(error);
      return unavailable();
    }
  } else {
    services.scheduleBackgroundTask(
      services.auth
        .handler(normalized)
        .then((response) => {
          if (response.status >= 500) logRequestFailure(response.status);
        })
        .catch(logRequestFailure),
    );
  }
  services.scheduleBackgroundTask(
    services.database
      .delete(signInRateLimits)
      .where(lte(signInRateLimits.expiresAt, Date.now()))
      .then(() => undefined)
      .catch(logRequestFailure),
  );
  // Acknowledge before account lookup so membership cannot be inferred by timing.
  return Response.json(
    { status: "accepted" },
    {
      status: copyActorId ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function unavailable() {
  return Response.json(
    { error: "email_delivery_failed" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function logRequestFailure(error: unknown) {
  console.error(
    "Magic link request processing failed.",
    error instanceof Error
      ? error.name
      : typeof error === "number"
        ? error
        : "UnknownError",
  );
}
