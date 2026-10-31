import { type Client, createClient } from "@libsql/client";
import {
  type DatabaseEnvironment,
  EnvironmentValidationError,
  formatEnvironmentReport,
  validateEnvironment,
} from "./environment";

export type DatabaseProvider = () => Pick<Client, "execute"> | undefined;

export function getDatabaseErrorCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,64}$/.test(error.code)
  ) {
    return error.code;
  }

  return undefined;
}

export function createDatabaseClient(
  env: NodeJS.ProcessEnv = process.env,
): Client | undefined {
  let configuration: DatabaseEnvironment;
  try {
    configuration = validateEnvironment("database", env);
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      console.error(formatEnvironmentReport(error.profile, error.issues));
    } else {
      console.error("Could not validate the database environment.");
    }
    return undefined;
  }

  return createDatabaseClientFromConfiguration(configuration);
}

export function createDatabaseClientFromConfiguration(
  configuration: DatabaseEnvironment,
): Client | undefined {
  try {
    return createClient({
      url: configuration.TURSO_DATABASE_URL,
      authToken: configuration.TURSO_AUTH_TOKEN,
    });
  } catch (error) {
    const code = getDatabaseErrorCode(error);
    console.error(
      code
        ? `Could not initialize the Turso client (${code}).`
        : "Could not initialize the Turso client from valid settings.",
    );
    return undefined;
  }
}

export function createDatabaseProvider(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseProvider {
  let client: Client | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      client = createDatabaseClient(env);
      initialized = true;
    }

    return client;
  };
}
