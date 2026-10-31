import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseClient, getDatabaseErrorCode } from "./database";
import * as schema from "./schema";

const client = createDatabaseClient();

if (!client) {
  process.exitCode = 1;
} else {
  try {
    await migrate(drizzle({ client, schema }), {
      migrationsFolder: "./drizzle",
    });
    console.info("Database migrations applied.");
  } catch (error) {
    const code = getDatabaseErrorCode(error);
    console.error(
      code
        ? `Database migration failed (${code}). Check the configured database and retry.`
        : "Database migration failed. Check the configured database and retry.",
    );
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
