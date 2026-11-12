import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createApp } from "./app";
import { type AuthServices, createAuth, createMagicLinkCapture } from "./auth";
import { LOCAL_DEMO_ACCOUNTS, seedLocalDemoData } from "./local-dev";
import { createLocalTicketStorage } from "./local-ticket-storage";
import * as schema from "./schema";

if (process.env.VERCEL) {
  throw new Error("The local API simulator must never run on Vercel.");
}

const localDirectory = resolve("../../.local");
await mkdir(localDirectory, { recursive: true });

const client = createClient({
  url: `file:${resolve(localDirectory, "traveler.db")}`,
});
const database = drizzle({ client, schema });
await migrate(database, { migrationsFolder: "./drizzle" });
const seeded = await seedLocalDemoData(database);
const magicLinkCapture = createMagicLinkCapture();
const localEnvironment = {
  BETTER_AUTH_SECRET:
    "traveler-local-development-only-secret-do-not-use-in-deployments",
  BETTER_AUTH_URL: "http://127.0.0.1:5173",
};
const services: AuthServices = {
  auth: createAuth(
    database,
    localEnvironment,
    async (_email, url) => {
      console.info(`\n[LIEN DE CONNEXION LOCAL]\n${url}\n`);
    },
    magicLinkCapture,
  ),
  database,
  scheduleBackgroundTask: (task) => {
    void task;
  },
  magicLinkCapture,
};
const app = createApp(
  () => client,
  () => services,
  {
    ticketStorage: createLocalTicketStorage(resolve(localDirectory, "tickets")),
    ticketStorageAvailable: () => true,
    authEnvironment: localEnvironment,
  },
);

console.info("Traveler local simulator — no Turso or Brevo connection.");
console.info("Demo accounts:");
for (const account of LOCAL_DEMO_ACCOUNTS)
  console.info(`- ${account.role}: ${account.email}`);
console.info(`Local database: ${resolve(localDirectory, "traveler.db")}`);
if (seeded) console.info("Missing demo accounts or trip have been added.");

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3001 }, (info) => {
  console.info(`Traveler API listening on http://127.0.0.1:${info.port}`);
});
