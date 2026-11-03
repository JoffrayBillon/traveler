import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import { RoomingError, type RoomMove } from "../services/rooming/model";
import { createRoomingService } from "../services/rooming/rooming-service";

export function registerRoomRequestCreateEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/room-requests", async (context) => {
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const membership = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!membership) return context.json({ error: "not_found" }, 404);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_room_change" }, 400);
    }
    const payload =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : undefined;
    let moves = payload?.moves;
    const targetRoomId = payload?.targetRoomId;
    const exchangeWithEmail = payload?.exchangeWithEmail;
    const rooming = createRoomingService(services.database);

    if (
      typeof targetRoomId === "string" &&
      typeof exchangeWithEmail === "string" &&
      exchangeWithEmail.trim()
    ) {
      try {
        moves = await rooming.resolveExchangeMoves(
          tripId,
          session.user.id,
          targetRoomId,
          exchangeWithEmail,
        );
      } catch (error) {
        if (
          error instanceof RoomingError &&
          error.code === "invalid_room_exchange"
        )
          return context.json({ error: error.code }, 409);
        return context.json({ error: "room_request_failed" }, 503);
      }
    }

    if (
      !Array.isArray(moves) ||
      moves.some(
        (move) =>
          !move ||
          typeof move !== "object" ||
          typeof move.userId !== "string" ||
          !(
            typeof move.expectedRoomId === "string" ||
            move.expectedRoomId === null
          ) ||
          typeof move.targetRoomId !== "string",
      )
    ) {
      return context.json({ error: "invalid_room_change" }, 400);
    }

    try {
      const request = await rooming.createRequest(
        tripId,
        session.user.id,
        moves as RoomMove[],
      );
      return context.json({ request }, 201);
    } catch (error) {
      if (error instanceof RoomingError)
        return context.json(
          { error: error.code },
          error.code === "traveler_not_in_trip" ||
            error.code === "room_not_in_trip"
            ? 404
            : 409,
        );
      return context.json({ error: "room_request_failed" }, 503);
    }
  });
}
