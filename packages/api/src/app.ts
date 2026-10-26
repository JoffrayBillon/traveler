import { Hono } from "hono";

const app = new Hono();

// Liveness only: this endpoint does not certify database or email readiness.
app.get("/api/health", (context) => {
  context.header("Cache-Control", "no-store");
  return context.json({ status: "ok" });
});

app.notFound((context) => context.json({ error: "not_found" }, 404));

export default app;
