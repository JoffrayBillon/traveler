import { type Client, createClient } from "@libsql/client";

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
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();

  if (!url || !authToken) {
    return undefined;
  }

  try {
    return createClient({ url, authToken });
  } catch {
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
