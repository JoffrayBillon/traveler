import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { listRoomAssignmentHistory } from "../datamodel/room-assignment-history.repository";
import { listRoomRequestsForMember } from "../datamodel/room-request.repository";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";

export function registerRoomHistoryReadEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.get("/api/trips/:tripId/rooming-history", async (context) => {
    context.header("Cache-Control", "private, no-store");
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

    const [requestData, actions] = await Promise.all([
      listRoomRequestsForMember(
        services.database,
        tripId,
        session.user.id,
        "applied",
      ),
      listRoomAssignmentHistory(
        services.database,
        tripId,
        session.user.id,
        actor.role !== "traveler",
      ),
    ]);
    if (!requestData) return context.json({ error: "not_found" }, 404);

    const requestHistory = requestData.requests
      .filter((request) => request.status === "applied")
      .map((request) => ({
        id: `request:${request.id}`,
        actionType: "traveler_request" as const,
        actorName:
          `${request.requester?.firstName ?? ""} ${request.requester?.lastName ?? ""}`.trim(),
        createdAt: request.updatedAt,
        changes: request.moves.map((move) => ({
          userId: move.userId,
          personName:
            `${move.person?.firstName ?? ""} ${move.person?.lastName ?? ""}`.trim(),
          fromRoom: move.currentRoom ?? null,
          toRoom: move.targetRoom ?? null,
        })),
      }));
    const organizerHistory = actions.map((action) => ({
      id: `action:${action.id}`,
      actionType: action.actionType,
      actorName: action.actorName,
      createdAt: action.createdAt,
      changes: JSON.parse(action.changesJson) as {
        userId: string;
        personName: string;
        fromRoom: string | null;
        toRoom: string | null;
      }[],
    }));

    return context.json({
      history: [...requestHistory, ...organizerHistory].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    });
  });
}
