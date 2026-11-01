import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getSession } from "../services/auth/get-session";
import { listUserTrips } from "../services/trips/list-user-trips";

export function registerIdentityEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/me", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const memberships = await listUserTrips(services.database, session.user.id);
    if (memberships.length === 0)
      return context.json({ error: "forbidden" }, 403);

    return context.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      trips: memberships,
    });
  });
}
