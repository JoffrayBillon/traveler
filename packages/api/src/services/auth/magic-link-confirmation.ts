import { getIP } from "better-auth/api";
import { z } from "zod";
import {
  type AuthServices,
  bindAuthToVerificationTransaction,
} from "../../auth";
import {
  findMagicLinkIdentity,
  findPendingMagicLink,
} from "../../datamodel/magic-link.repository";

export const magicLinkConfirmationSchema = z.object({
  token: z.string().min(1).max(128),
  callbackURL: z.string().max(2048).optional(),
  newUserCallbackURL: z.string().max(2048).optional(),
});

import { reserveMagicLinkRequest } from "./magic-link-rate-limit";

class RollBackVerification extends Error {
  constructor(readonly response: Response) {
    super("Verification did not issue a session");
  }
}

const recordSchema = z.object({
  type: z.literal("magic-link"),
  email: z.email(),
});

export async function previewMagicLink(services: AuthServices, token: string) {
  const pending = await findPendingMagicLink(services.database, token);
  if (!pending) return null;
  let value: unknown;
  try {
    value = JSON.parse(pending.value);
  } catch {
    return null;
  }
  const record = recordSchema.safeParse(value);
  if (!record.success) return null;
  return (
    (await findMagicLinkIdentity(services.database, record.data.email)) ?? null
  );
}

export async function confirmMagicLink(
  services: AuthServices,
  request: Request,
  input: z.infer<typeof magicLinkConfirmationSchema>,
) {
  const authContext = await services.auth.$context;
  for (const callback of [input.callbackURL, input.newUserCallbackURL]) {
    if (
      callback &&
      !authContext.isTrustedOrigin(callback, { allowRelativePaths: true })
    ) {
      return Response.json({ error: "invalid_callback_url" }, { status: 403 });
    }
  }
  const url = new URL("/api/auth/magic-link/verify", request.url);
  url.searchParams.set("token", input.token);
  url.searchParams.set("callbackURL", input.callbackURL || "/");
  if (input.newUserCallbackURL)
    url.searchParams.set("newUserCallbackURL", input.newUserCallbackURL);
  url.searchParams.set("errorCallbackURL", "/sign-in/confirm?error=invalid");
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("content-type");
  try {
    const retryAfter = await reserveMagicLinkRequest(
      services.database,
      "verification",
      getIP(request, services.auth.options) ?? "local",
      60,
      5,
    );
    if (retryAfter !== null) {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    return await services.database.transaction(async (transaction) => {
      const auth = bindAuthToVerificationTransaction(
        services.auth,
        transaction,
      );
      const response = await auth.handler(
        new Request(url, { method: "GET", headers }),
      );
      const ctx = await auth.$context;
      const cookieName = `${ctx.authCookies.sessionToken.name}=`;
      if (
        !response.headers
          .getSetCookie()
          .some(
            (cookie) =>
              cookie.startsWith(cookieName) &&
              Boolean(cookie.slice(cookieName.length).split(";", 1)[0]),
          )
      ) {
        throw new RollBackVerification(response);
      }
      return response;
    });
  } catch (error) {
    if (error instanceof RollBackVerification) return error.response;
    console.error(
      "Magic link confirmation failed.",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }
}
