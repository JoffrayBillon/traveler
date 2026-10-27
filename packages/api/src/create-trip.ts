import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseClient, getDatabaseErrorCode } from "./database";
import * as schema from "./schema";
import { createTripsStore } from "./trips";

const name = process.argv.slice(2).join(" ").trim();

if (!name) {
  console.error(
    'Usage: pnpm --filter @traveler/api trips:create -- "Trip name"',
  );
  process.exitCode = 1;
} else {
  const client = createDatabaseClient();

  if (!client) {
    console.error(
      "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before creating a trip.",
    );
    process.exitCode = 1;
  } else {
    try {
      const trip = await createTripsStore(drizzle({ client, schema })).create(
        name,
      );
      console.info(`Created trip ${trip.id}: ${trip.name}`);
    } catch (error) {
      const code = getDatabaseErrorCode(error);
      console.error(
        code
          ? `Trip creation failed (${code}). Check the configured database and retry.`
          : "Trip creation failed. Check the configured database and retry.",
      );
      process.exitCode = 1;
    } finally {
      await client.close();
    }
  }
}
