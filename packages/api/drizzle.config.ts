import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // `generate` reads schema and does not connect; live credentials are used only by the explicit migration command.
    url: process.env.TURSO_DATABASE_URL ?? "libsql://generate-only.invalid",
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  },
});
