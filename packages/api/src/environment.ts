import type {
  StandardSchemaDictionary,
  StandardSchemaV1,
} from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export type EnvironmentProfile = "api" | "database" | "auth" | "auth-injected";

export type EnvironmentIssue = {
  variable: string;
  message: string;
};

const databaseSchema = {
  TURSO_DATABASE_URL: z
    .string({ error: "required" })
    .url({ error: "must be a valid URL" })
    .refine((value) => value.startsWith("libsql://"), {
      error: "must use the libsql:// protocol",
    }),
  TURSO_AUTH_TOKEN: z.string({ error: "required" }).min(1, {
    error: "must not be empty",
  }),
};

const authSchema = {
  BETTER_AUTH_SECRET: z.string({ error: "required" }).min(32, {
    error: "must contain at least 32 characters",
  }),
  BETTER_AUTH_URL: z
    .string()
    .url({ error: "must be a valid absolute URL" })
    .refine((value) => /^https?:\/\//.test(value), {
      error: "must use http:// or https://",
    })
    .optional(),
  VERCEL_URL: z
    .string()
    .min(1, { error: "must not be empty" })
    .refine(isDeploymentHost, { error: "must be a valid deployment host" })
    .optional(),
  VERCEL_BRANCH_URL: z
    .string()
    .min(1, { error: "must not be empty" })
    .refine(isDeploymentHost, { error: "must be a valid deployment host" })
    .optional(),
  BREVO_API_KEY: z.string({ error: "required" }).min(1, {
    error: "must not be empty",
  }),
  BREVO_SENDER_EMAIL: z
    .string({ error: "required" })
    .email({ error: "must be a valid email address" }),
};

const optionalServiceSchema = {
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  VERCEL: z.string().optional(),
};

const profiles = {
  api: {
    ...databaseSchema,
    ...authSchema,
    ...optionalServiceSchema,
  },
  database: databaseSchema,
  auth: authSchema,
  "auth-injected": {
    BETTER_AUTH_SECRET: authSchema.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: authSchema.BETTER_AUTH_URL,
    VERCEL_URL: authSchema.VERCEL_URL,
    VERCEL_BRANCH_URL: authSchema.VERCEL_BRANCH_URL,
  },
} as const;

const groupByVariable: Record<string, string> = {
  TURSO_DATABASE_URL: "Database",
  TURSO_AUTH_TOKEN: "Database",
  BETTER_AUTH_SECRET: "Authentication",
  BETTER_AUTH_URL: "Authentication",
  VERCEL_URL: "Authentication",
  VERCEL_BRANCH_URL: "Authentication",
  BREVO_API_KEY: "Email delivery",
  BREVO_SENDER_EMAIL: "Email delivery",
  BLOB_READ_WRITE_TOKEN: "Ticket storage",
};

export class EnvironmentValidationError extends Error {
  readonly profile: string;
  readonly issues: EnvironmentIssue[];

  constructor(profile: string, issues: EnvironmentIssue[]) {
    super(`Invalid environment configuration for ${profile}.`);
    this.name = "EnvironmentValidationError";
    this.profile = profile;
    this.issues = issues;
  }
}

export type DatabaseEnvironment = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

export type ApiEnvironment = DatabaseEnvironment & {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BLOB_READ_WRITE_TOKEN?: string;
  VERCEL?: string;
};

export type AuthEnvironment = {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
};

export function validateEnvironment(
  profile: "api",
  source?: NodeJS.ProcessEnv,
): ApiEnvironment;
export function validateEnvironment(
  profile: "database",
  source?: NodeJS.ProcessEnv,
): DatabaseEnvironment;
export function validateEnvironment(
  profile: "auth" | "auth-injected",
  source?: NodeJS.ProcessEnv,
): AuthEnvironment;
export function validateEnvironment(
  profile: EnvironmentProfile,
  source: NodeJS.ProcessEnv = process.env,
): ApiEnvironment | DatabaseEnvironment | AuthEnvironment {
  const server = profiles[profile];

  try {
    const parsed = parseWithT3Env(server, source, profile);

    if (profile === "api") {
      return parsed as ApiEnvironment;
    }
    if (profile === "database") return parsed as DatabaseEnvironment;
    const crossFieldIssues = getCrossFieldIssues(profile, source);
    if (crossFieldIssues.length) {
      throw new EnvironmentValidationError(profile, crossFieldIssues);
    }
    return parsed as unknown as AuthEnvironment;
  } catch (error) {
    if (error instanceof EnvironmentValidationError) throw error;
    throw new Error(`Could not validate the ${profile} environment.`, {
      cause: error,
    });
  }
}

function parseWithT3Env(
  server: StandardSchemaDictionary,
  source: NodeJS.ProcessEnv,
  profile: EnvironmentProfile,
) {
  return createEnv({
    server,
    runtimeEnv: source,
    emptyStringAsUndefined: true,
    onValidationError: (issues) => {
      const environmentIssues = toEnvironmentIssues(issues);
      environmentIssues.push(...getCrossFieldIssues(profile, source));
      throw new EnvironmentValidationError(profile, environmentIssues);
    },
  }) as Record<string, string | undefined>;
}

export function getEnvironmentWarnings(
  profile: EnvironmentProfile,
  source: NodeJS.ProcessEnv = process.env,
): EnvironmentIssue[] {
  if (
    profile === "api" &&
    !source.VERCEL?.trim() &&
    !source.BLOB_READ_WRITE_TOKEN?.trim()
  ) {
    return [
      {
        variable: "BLOB_READ_WRITE_TOKEN",
        message:
          "ticket uploads need this token outside Vercel; other API features remain available",
      },
    ];
  }
  return [];
}

function getCrossFieldIssues(
  profile: EnvironmentProfile,
  source: NodeJS.ProcessEnv,
): EnvironmentIssue[] {
  if (
    profile !== "database" &&
    !source.BETTER_AUTH_URL?.trim() &&
    !source.VERCEL_URL?.trim() &&
    !source.VERCEL_BRANCH_URL?.trim()
  ) {
    return [
      {
        variable: "BETTER_AUTH_URL",
        message:
          "set BETTER_AUTH_URL or a Vercel deployment URL (VERCEL_URL / VERCEL_BRANCH_URL)",
      },
    ];
  }
  return [];
}

export function formatEnvironmentReport(
  profile: string,
  issues: EnvironmentIssue[],
  heading = "Invalid environment configuration",
) {
  const lines = [`${heading} (${profile}):`];
  const groups = [
    ...new Set(
      issues.map(({ variable }) => groupByVariable[variable] ?? "Other"),
    ),
  ];
  for (const group of groups) {
    lines.push(`${group}:`);
    for (const issue of issues.filter(
      ({ variable }) => (groupByVariable[variable] ?? "Other") === group,
    )) {
      lines.push(`  - ${issue.variable}: ${issue.message}`);
    }
  }
  return lines.join("\n");
}

function toEnvironmentIssues(
  issues: readonly StandardSchemaV1.Issue[],
): EnvironmentIssue[] {
  return issues.map((issue) => ({
    variable: pathToVariable(issue.path),
    message: issue.message,
  }));
}

function pathToVariable(path: StandardSchemaV1.Issue["path"]) {
  const first = path?.[0];
  if (typeof first === "string" || typeof first === "number") {
    return String(first);
  }
  if (first && typeof first === "object" && "key" in first) {
    return String(first.key);
  }
  return "environment";
}

function isDeploymentHost(value: string) {
  try {
    const url = new URL(`https://${value}`);
    return url.host === value && !url.username && !url.password;
  } catch {
    return false;
  }
}
