import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseClient, getDatabaseErrorCode } from "./database";
import * as schema from "./schema";
import { createTripsStore } from "./trips";

const client = createDatabaseClient();

if (!client) {
  console.error(
    "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before listing trips.",
  );
  process.exitCode = 1;
} else {
  try {
    const trips = await createTripsStore(drizzle({ client, schema })).list();
    for (const trip of trips) {
      console.info(`${trip.id}\t${trip.name}`);
    }
  } catch (error) {
    const code = getDatabaseErrorCode(error);
    console.error(
      code
        ? `Trip listing failed (${code}). Check the configured database and retry.`
        : "Trip listing failed. Check the configured database and retry.",
    );
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
