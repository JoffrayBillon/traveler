import { randomUUID } from "node:crypto";
import type { Auth, BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { normalizeEmail } from "./email";
import { validateEnvironment } from "./environment";
import type { BackgroundTaskScheduler } from "./ports/background-task-scheduler";
import type { MagicLinkSender } from "./ports/email-sender";
import * as schema from "./schema";

export type AppDatabase = LibSQLDatabase<typeof schema>;
export type AuthServices = {
  auth: Auth<BetterAuthOptions>;
  database: AppDatabase;
  scheduleBackgroundTask: BackgroundTaskScheduler;
  magicLinkCapture?: MagicLinkCapture;
};
export type { BackgroundTaskScheduler } from "./ports/background-task-scheduler";
export type { MagicLinkSender } from "./ports/email-sender";
export type MagicLinkCapture = {
  authorize: (requestId: string) => void;
  capture: (requestId: string, url: string) => boolean;
  take: (requestId: string) => string | undefined;
};

export function createMagicLinkCapture(): MagicLinkCapture {
  const authorizedRequests = new Set<string>();
  const generatedLinks = new Map<string, string>();
  return {
    authorize(requestId) {
      authorizedRequests.add(requestId);
    },
    capture(requestId, url) {
      if (!authorizedRequests.delete(requestId)) return false;
      generatedLinks.set(requestId, url);
      return true;
    },
    take(requestId) {
      authorizedRequests.delete(requestId);
      const url = generatedLinks.get(requestId);
      generatedLinks.delete(requestId);
      return url;
    },
  };
}

function toOrigin(value: string) {
  const url =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
  return new URL(url).origin;
}

function toHost(value: string) {
  const url =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
  return new URL(url).host;
}

export function isTrustedAuthOrigin(origin: string, env: NodeJS.ProcessEnv) {
  try {
    const requestedOrigin = new URL(origin).origin;
    return [env.BETTER_AUTH_URL, env.VERCEL_URL, env.VERCEL_BRANCH_URL]
      .filter((value): value is string => Boolean(value?.trim()))
      .some((value) => toOrigin(value.trim()) === requestedOrigin);
  } catch {
    return false;
  }
}

export function createAuth(
  database: AppDatabase,
  env: NodeJS.ProcessEnv,
  sendEmail?: MagicLinkSender,
  magicLinkCapture?: MagicLinkCapture,
): Auth<BetterAuthOptions> {
  const authEnvironment = validateEnvironment(
    sendEmail ? "auth-injected" : "auth",
    env,
  );
  if (!sendEmail) {
    throw new Error("A magic-link email adapter must be injected.");
  }
  const baseURL =
    authEnvironment.BETTER_AUTH_URL?.trim() ||
    (authEnvironment.VERCEL_BRANCH_URL
      ? `https://${authEnvironment.VERCEL_BRANCH_URL.trim()}`
      : authEnvironment.VERCEL_URL
        ? `https://${authEnvironment.VERCEL_URL.trim()}`
        : undefined);
  const allowedHosts = [
    authEnvironment.BETTER_AUTH_URL,
    authEnvironment.VERCEL_URL,
    authEnvironment.VERCEL_BRANCH_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(toHost);
  const secret = authEnvironment.BETTER_AUTH_SECRET.trim();
  if (!baseURL || allowedHosts.length === 0 || !secret) {
    throw new Error("Validated authentication configuration is incomplete.");
  }
  const trustedOrigins = [
    authEnvironment.BETTER_AUTH_URL,
    authEnvironment.VERCEL_URL,
    authEnvironment.VERCEL_BRANCH_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(toOrigin);

  const hasMembershipForEmail = async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    const matchingUsers = await database
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(sql<string>`lower(${schema.users.email})`, normalizedEmail))
      .limit(2);
    const matchingUser = matchingUsers[0];
    if (matchingUsers.length !== 1 || !matchingUser) return false;
    const [membership] = await database
      .select({ id: schema.tripMemberships.id })
      .from(schema.tripMemberships)
      .where(eq(schema.tripMemberships.userId, matchingUser.id))
      .limit(1);
    if (!membership) return false;
    if (matchingUser.email !== normalizedEmail) {
      await database
        .update(schema.users)
        .set({ email: normalizedEmail, updatedAt: new Date() })
        .where(eq(schema.users.id, matchingUser.id));
    }
    return true;
  };

  const options: BetterAuthOptions = {
    appName: "Traveler",
    baseURL: {
      allowedHosts: [...new Set(allowedHosts)],
      fallback: baseURL,
      protocol: "auto",
    },
    secret,
    trustedOrigins: [...new Set(trustedOrigins)],
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.rateLimits,
      },
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/magic-link": { window: 60, max: 5 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-in/magic-link") return;
        const body = context.body;
        if (
          !body ||
          typeof body !== "object" ||
          !("email" in body) ||
          typeof body.email !== "string"
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Unable to process sign-in request.",
          });
        }
        if (!(await hasMembershipForEmail(body.email))) {
          throw new APIError("BAD_REQUEST", {
            message: "Unable to process sign-in request.",
          });
        }
      }),
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        expiresIn: 60 * 10,
        storeToken: "hashed",
        rateLimit: { window: 60, max: 5 },
        sendMagicLink: async ({ email, url, metadata }) => {
          try {
            const requestId = metadata?.copySignInLinkRequestId;
            if (
              typeof requestId === "string" &&
              magicLinkCapture?.capture(requestId, url)
            ) {
              return;
            }
            await sendEmail(email, url, metadata);
          } catch (error) {
            console.error(
              "Magic link email delivery failed.",
              error instanceof Error ? error.name : "UnknownError",
            );
            throw error;
          }
        },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const memberships = await database
              .select({ id: schema.tripMemberships.id })
              .from(schema.tripMemberships)
              .where(eq(schema.tripMemberships.userId, session.userId));
            if (memberships.length === 0) return false;
            return true;
          },
          after: async (session) => {
            await database
              .update(schema.tripMemberships)
              .set({ lastLoginAt: new Date() })
              .where(eq(schema.tripMemberships.userId, session.userId));
          },
        },
      },
    },
    advanced: { database: { generateId: () => randomUUID() } },
  };
  return betterAuth(options);
}
