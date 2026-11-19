import { z } from "zod";
import type { AuthServices } from "../../auth";
import {
  findMagicLinkIdentity,
  findPendingMagicLink,
} from "../../datamodel/magic-link.repository";

export const magicLinkConfirmationSchema = z.object({
  token: z.string().min(1).max(128),
  callbackURL: z.string().max(2048).optional(),
  newUserCallbackURL: z.string().max(2048).optional(),
});

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
  return services.auth.handler(new Request(url, { method: "GET", headers }));
}
