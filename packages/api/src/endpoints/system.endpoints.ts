import type { Hono } from "hono";
import type { DatabaseProvider } from "../database";

export function registerSystemEndpoints(
  app: Hono,
  getDatabase: DatabaseProvider,
) {
  app.get("/api/health", (context) => {
    context.header("Cache-Control", "no-store");
    return context.json({ status: "ok" });
  });

  app.get("/api/ready", async (context) => {
    context.header("Cache-Control", "no-store");
    const database = getDatabase();
    if (!database) return context.json({ status: "not_ready" }, 503);
    try {
      await database.execute("SELECT 1");
      return context.json({ status: "ready" });
    } catch {
      return context.json({ status: "not_ready" }, 503);
    }
  });
}
