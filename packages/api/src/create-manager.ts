import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseClient, getDatabaseErrorCode } from "./database";
import { createManagersStore } from "./managers";
import * as schema from "./schema";

const args = process.argv
  .slice(2)
  .filter((argument, index) => !(index === 0 && argument === "--"));
const [tripId, email, firstName, lastName, ...extra] = args;

if (!tripId || !email || !firstName || !lastName || extra.length > 0) {
  console.error(
    "Usage: pnpm --filter @traveler/api managers:create -- <trip-id> <email> <first-name> <last-name>",
  );
  process.exitCode = 1;
} else {
  const client = createDatabaseClient();
  if (!client) {
    console.error(
      "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before provisioning a manager.",
    );
    process.exitCode = 1;
  } else {
    try {
      const manager = await createManagersStore(
        drizzle({ client, schema }),
      ).create({
        tripId,
        email,
        firstName,
        lastName,
      });
      console.info(
        `Provisioned ${manager.email} as manager for trip ${manager.tripId}.`,
      );
      console.info(
        "The manager can request a sign-in link once email delivery is configured.",
      );
    } catch (error) {
      const code = getDatabaseErrorCode(error);
      const message =
        error instanceof Error && error.name === "ManagerProvisioningError"
          ? error.message
          : code
            ? `Manager provisioning failed (${code}). Check the configured database and retry.`
            : "Manager provisioning failed. Check the configured database and retry.";
      console.error(message);
      process.exitCode = 1;
    } finally {
      await client.close();
    }
  }
}
