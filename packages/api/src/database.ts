import { type Client, createClient } from "@libsql/client";

export type DatabaseProvider = () => Pick<Client, "execute"> | undefined;

export function createDatabaseProvider(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseProvider {
  let client: Client | undefined;

  return () => {
    const url = env.TURSO_DATABASE_URL?.trim();
    const authToken = env.TURSO_AUTH_TOKEN?.trim();

    if (!url || !authToken) {
      return undefined;
    }

    if (!client) {
      try {
        client = createClient({ url, authToken });
      } catch {
        return undefined;
      }
    }

    return client;
  };
}
