import { randomUUID } from "node:crypto";
import { Brevo, BrevoClient, BrevoError } from "@getbrevo/brevo";
import { waitUntil } from "@vercel/functions";
import type { Auth, BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseClient } from "./database";
import * as schema from "./schema";

export type AppDatabase = LibSQLDatabase<typeof schema>;
export type AuthServices = {
  auth: Auth<BetterAuthOptions>;
  database: AppDatabase;
  scheduleBackgroundTask: BackgroundTaskScheduler;
};
export type MagicLinkSender = (email: string, url: string) => Promise<void>;
export type BackgroundTaskScheduler = (task: Promise<unknown>) => void;

function scheduleBackgroundTask(task: Promise<unknown>) {
  if (process.env.VERCEL) {
    waitUntil(task);
  } else {
    void task;
  }
}

function toOrigin(value: string) {
  const url =
    value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
  return new URL(url).origin;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

async function sendLoginLink(
  email: string,
  url: string,
  env: NodeJS.ProcessEnv,
) {
  const apiKey = env.BREVO_API_KEY?.trim();
  const senderEmail = env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail) {
    throw new Error("Authentication email delivery is not configured.");
  }

  const safeUrl = escapeHtml(url);
  const client = new BrevoClient({
    apiKey,
    maxRetries: 1,
    timeoutInSeconds: 10,
  });
  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: "BotMail", email: senderEmail },
      to: [{ email }],
      subject: "Votre lien de connexion Traveler",
      textContent: `Connectez-vous à votre espace Traveler : ${url}\n\nCe lien expire après 10 minutes et ne peut être utilisé qu’une fois.`,
      htmlContent: `<p>Connectez-vous à votre espace Traveler.</p><p><a href="${safeUrl}">Ouvrir mon espace voyage</a></p><p>Ce lien expire après 10 minutes et ne peut être utilisé qu’une fois.</p>`,
    });
  } catch (error) {
    if (error instanceof Brevo.UnauthorizedError) {
      throw new Error("Brevo rejected the API key.");
    }
    if (error instanceof Brevo.ForbiddenError) {
      throw new Error("Brevo rejected the sender or API permission.");
    }
    if (error instanceof BrevoError) {
      throw new Error(
        `Brevo email API responded with HTTP ${error.statusCode}.`,
      );
    }
    throw error;
  }
}

export function createAuth(
  database: AppDatabase,
  env: NodeJS.ProcessEnv,
  sendEmail: MagicLinkSender = (email, url) => sendLoginLink(email, url, env),
  scheduleTask: BackgroundTaskScheduler = scheduleBackgroundTask,
): Auth<BetterAuthOptions> {
  const baseURL =
    env.BETTER_AUTH_URL?.trim() ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL.trim()}` : undefined);
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!baseURL || !secret || secret.length < 32) {
    throw new Error("Authentication configuration is incomplete.");
  }
  const trustedOrigins = [
    env.BETTER_AUTH_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(toOrigin);

  const hasMembershipForEmail = async (email: string) => {
    const membership = await database
      .select({ id: schema.tripMemberships.id })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.users,
        eq(schema.tripMemberships.userId, schema.users.id),
      )
      .where(eq(schema.users.email, email.trim().toLowerCase()))
      .limit(1);
    return membership.length > 0;
  };

  const options: BetterAuthOptions = {
    appName: "Traveler",
    baseURL,
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
        sendMagicLink: async ({ email, url }) => {
          const delivery = sendEmail(email, url).catch((error: unknown) => {
            const details =
              error instanceof Error ? error.message : "UnknownError";
            console.error("Magic link email delivery failed.", details);
          });
          scheduleTask(delivery);
        },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const membership = await database
              .select({ id: schema.tripMemberships.id })
              .from(schema.tripMemberships)
              .where(eq(schema.tripMemberships.userId, session.userId))
              .limit(1);
            return membership.length > 0;
          },
        },
      },
    },
    advanced: { database: { generateId: () => randomUUID() } },
  };
  return betterAuth(options);
}

export function createAuthServicesProvider(
  env: NodeJS.ProcessEnv = process.env,
): () => AuthServices | undefined {
  let services: AuthServices | undefined;
  let initialized = false;
  return () => {
    if (initialized) return services;
    initialized = true;
    const client = createDatabaseClient(env);
    if (
      !client ||
      !env.BETTER_AUTH_SECRET?.trim() ||
      !(env.BETTER_AUTH_URL?.trim() || env.VERCEL_URL?.trim())
    ) {
      return undefined;
    }
    try {
      const database = drizzle({ client, schema });
      services = {
        auth: createAuth(database, env, undefined, scheduleBackgroundTask),
        database,
        scheduleBackgroundTask,
      };
      return services;
    } catch {
      return undefined;
    }
  };
}
