import { randomUUID } from "node:crypto";
import { Brevo, BrevoClient, BrevoError } from "@getbrevo/brevo";
import { waitUntil } from "@vercel/functions";
import type { Auth, BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseClientFromConfiguration } from "./database";
import { normalizeEmail } from "./email";
import {
  type ApiEnvironment,
  EnvironmentValidationError,
  formatEnvironmentReport,
  getEnvironmentWarnings,
  validateEnvironment,
} from "./environment";
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
  env: {
    BREVO_API_KEY?: string;
    BREVO_SENDER_EMAIL?: string;
  },
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
  sendEmail?: MagicLinkSender,
): Auth<BetterAuthOptions> {
  const authEnvironment = validateEnvironment(
    sendEmail ? "auth-injected" : "auth",
    env,
  );
  const deliverLoginLink: MagicLinkSender =
    sendEmail ?? ((email, url) => sendLoginLink(email, url, authEnvironment));
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
        sendMagicLink: async ({ email, url }) => {
          try {
            await deliverLoginLink(email, url);
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

export function createAuthServicesProvider(
  env: NodeJS.ProcessEnv = process.env,
): () => AuthServices | undefined {
  let services: AuthServices | undefined;
  let initialized = false;
  return () => {
    if (initialized) return services;
    initialized = true;
    let configuration: ApiEnvironment;
    try {
      configuration = validateEnvironment("api", env);
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        console.error(formatEnvironmentReport(error.profile, error.issues));
      } else {
        console.error("Could not validate the application environment.");
      }
      return undefined;
    }
    const warnings = getEnvironmentWarnings("api", env);
    if (warnings.length) {
      console.warn(
        formatEnvironmentReport(
          "api",
          warnings,
          "Optional environment variables are not configured",
        ),
      );
    }
    const client = createDatabaseClientFromConfiguration(configuration);
    if (!client) return undefined;
    try {
      const database = drizzle({ client, schema });
      services = {
        auth: createAuth(database, env),
        database,
        scheduleBackgroundTask,
      };
      return services;
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        console.error(formatEnvironmentReport(error.profile, error.issues));
      } else {
        console.error(
          "Could not initialize authentication services.",
          error instanceof Error ? error.name : "UnknownError",
        );
      }
      return undefined;
    }
  };
}
