import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AuthServices } from "./auth";
import { createAuthServicesProvider } from "./auth";
import { createDatabaseProvider } from "./database";
import * as schema from "./schema";

export function createApp(
  getDatabase = createDatabaseProvider(),
  getAuthServices = createAuthServicesProvider(),
) {
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

  app.all("/api/auth/*", async (context) => {
    const services = getAuthServices();
    if (!services) {
      context.header("Cache-Control", "no-store");
      return context.json({ error: "service_unavailable" }, 503);
    }
    if (
      context.req.method === "POST" &&
      context.req.path === "/api/auth/sign-in/magic-link"
    ) {
      return await handleMagicLinkRequest(services, context.req.raw);
    }
    return services.auth.handler(context.req.raw);
  });

  app.get("/api/me", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);

    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const memberships = await services.database
      .select({
        tripId: schema.trips.id,
        tripName: schema.trips.name,
        role: schema.tripMemberships.role,
      })
      .from(schema.tripMemberships)
      .innerJoin(
        schema.trips,
        eq(schema.tripMemberships.tripId, schema.trips.id),
      )
      .where(eq(schema.tripMemberships.userId, session.user.id))
      .orderBy(schema.trips.name, schema.trips.id);

    if (memberships.length === 0) {
      return context.json({ error: "forbidden" }, 403);
    }

    return context.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      trips: memberships,
    });
  });

  app.notFound((context) => context.json({ error: "not_found" }, 404));

  return app;
}

async function handleMagicLinkRequest(
  services: AuthServices,
  request: Request,
) {
  const normalizedRequest = await normalizeMagicLinkRequest(request);
  const response = await services.auth.handler(normalizedRequest);
  if (response.status === 429) {
    return Response.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": response.headers.get("X-Retry-After") ?? "60",
        },
      },
    );
  }

  // Keep the public acknowledgement the same for invited and unknown addresses.
  return Response.json(
    { status: "accepted" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function normalizeMagicLinkRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return request;
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    typeof body.email !== "string"
  ) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify({ ...body, email: body.email.trim().toLowerCase() }),
  });
}

async function getSession(
  services: AuthServices,
  headers: Headers,
): Promise<Awaited<ReturnType<typeof services.auth.api.getSession>>> {
  return services.auth.api.getSession({ headers });
}

const app = createApp();

export default app;
