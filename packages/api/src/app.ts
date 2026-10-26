import { Hono } from "hono";
import { createDatabaseProvider } from "./database";

export function createApp(getDatabase = createDatabaseProvider()) {
  const app = new Hono();

  // Liveness only: this endpoint does not certify database or email readiness.
  app.get("/api/health", (context) => {
    context.header("Cache-Control", "no-store");
    return context.json({ status: "ok" });
  });

  app.get("/api/ready", async (context) => {
    context.header("Cache-Control", "no-store");
    const database = getDatabase();

    if (!database) {
      return context.json({ status: "not_ready" }, 503);
    }

    try {
      await database.execute("SELECT 1");
      return context.json({ status: "ready" });
    } catch {
      return context.json({ status: "not_ready" }, 503);
    }
  });

  app.notFound((context) => context.json({ error: "not_found" }, 404));

  return app;
}

const app = createApp();

export default app;
