import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  appointTripCompanion,
  createTravelerParticipant,
} from "../services/participant-management";

export function registerParticipantCreationEndpoints(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/companions", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const actor = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_companion" }, 400);
    }
    try {
      const result = await appointTripCompanion(
        services.database,
        tripId,
        body,
      );
      if ("error" in result) {
        const status = result.error === "invalid_companion" ? 400 : 409;
        return context.json({ error: result.error }, status);
      }
      return context.json(
        { status: "appointed", companion: result.companion },
        201,
      );
    } catch {
      return context.json({ error: "companion_appointment_failed" }, 503);
    }
  });

  app.post("/api/trips/:tripId/participants", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);
    const tripId = context.req.param("tripId");
    const actor = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!actor) return context.json({ error: "not_found" }, 404);
    if (actor.role !== "manager")
      return context.json({ error: "forbidden" }, 403);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_participant" }, 400);
    }
    try {
      const result = await createTravelerParticipant(
        services.database,
        tripId,
        body,
      );
      if ("error" in result) {
        const status = result.error === "invalid_participant" ? 400 : 409;
        return context.json({ error: result.error }, status);
      }
      return context.json(
        { status: "created", participant: result.participant },
        201,
      );
    } catch {
      return context.json({ error: "participant_creation_failed" }, 503);
    }
  });
}
