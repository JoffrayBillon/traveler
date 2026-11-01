import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import * as schema from "../../schema";
import { applyApprovedRequest } from "./apply-approved-request";
import { type RoomChangePayload, RoomingError, type RoomMove } from "./model";
import { resolveRoomExchangeMoves } from "./resolve-room-exchange";

export function createRoomingService(database: AppDatabase) {
  return {
    resolveExchangeMoves: (
      tripId: string,
      requesterUserId: string,
      targetRoomId: string,
      exchangeWithEmail: string,
    ) =>
      resolveRoomExchangeMoves(
        database,
        tripId,
        requesterUserId,
        targetRoomId,
        exchangeWithEmail,
      ),

    async createRequest(
      tripId: string,
      requesterUserId: string,
      moves: RoomMove[],
    ) {
      return database.transaction(async (transaction) => {
        if (
          moves.length === 0 ||
          moves.length > 20 ||
          new Set(moves.map((move) => move.userId)).size !== moves.length ||
          !moves.some((move) => move.userId === requesterUserId) ||
          moves.some(
            (move) =>
              !move.userId ||
              !move.targetRoomId ||
              move.expectedRoomId === move.targetRoomId,
          )
        ) {
          throw new RoomingError("invalid_room_change");
        }
        const userIds = moves.map((move) => move.userId);
        const memberships = await transaction
          .select({
            userId: schema.tripMemberships.userId,
            gender: schema.tripMemberships.gender,
          })
          .from(schema.tripMemberships)
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              inArray(schema.tripMemberships.userId, userIds),
            ),
          );
        if (memberships.length !== userIds.length)
          throw new RoomingError("traveler_not_in_trip");

        const rooms = await transaction
          .select({
            id: schema.rooms.id,
            capacity: schema.rooms.capacity,
            genderPolicy: schema.rooms.genderPolicy,
            compositionVersion: schema.rooms.compositionVersion,
          })
          .from(schema.rooms)
          .where(eq(schema.rooms.tripId, tripId));
        const roomById = new Map(rooms.map((room) => [room.id, room]));
        for (const move of moves) {
          if (
            !roomById.has(move.targetRoomId) ||
            (move.expectedRoomId && !roomById.has(move.expectedRoomId))
          ) {
            throw new RoomingError("room_not_in_trip");
          }
        }

        const assignments = await transaction
          .select({
            id: schema.roomAssignments.id,
            userId: schema.roomAssignments.userId,
            roomId: schema.roomAssignments.roomId,
          })
          .from(schema.roomAssignments)
          .where(eq(schema.roomAssignments.tripId, tripId));
        const currentByUser = new Map(
          assignments.map((assignment) => [
            assignment.userId,
            assignment.roomId,
          ]),
        );
        for (const move of moves) {
          if (
            (currentByUser.get(move.userId) ?? null) !== move.expectedRoomId
          ) {
            throw new RoomingError("room_assignment_changed");
          }
        }

        const memberRows = await transaction
          .select({
            userId: schema.tripMemberships.userId,
            gender: schema.tripMemberships.gender,
          })
          .from(schema.tripMemberships)
          .where(eq(schema.tripMemberships.tripId, tripId));
        const genderByUser = new Map(
          memberRows.map((member) => [member.userId, member.gender]),
        );
        const afterByUser = new Map(currentByUser);
        const affectedRoomIds = new Set<string>();
        for (const move of moves) {
          if (move.expectedRoomId) affectedRoomIds.add(move.expectedRoomId);
          affectedRoomIds.add(move.targetRoomId);
          afterByUser.set(move.userId, move.targetRoomId);
        }
        const projectedCount = new Map<string, number>();
        for (const roomId of afterByUser.values()) {
          if (!affectedRoomIds.has(roomId)) continue;
          projectedCount.set(roomId, (projectedCount.get(roomId) ?? 0) + 1);
        }
        for (const [roomId, count] of projectedCount) {
          const room = roomById.get(roomId);
          if (!room || count > room.capacity)
            throw new RoomingError("room_capacity_exceeded");
        }

        const requiredConsents = new Set(userIds);
        for (const roomId of affectedRoomIds) {
          const beforeGender = new Set(
            assignments
              .filter((assignment) => assignment.roomId === roomId)
              .map((assignment) => genderByUser.get(assignment.userId))
              .filter(
                (gender): gender is "M" | "F" =>
                  gender !== null && gender !== undefined,
              ),
          );
          const afterOccupants = [...afterByUser.entries()]
            .filter(([, assignedRoomId]) => assignedRoomId === roomId)
            .map(([userId]) => userId);
          const afterGender = new Set(
            afterOccupants
              .map((userId) => genderByUser.get(userId))
              .filter(
                (gender): gender is "M" | "F" =>
                  gender !== null && gender !== undefined,
              ),
          );
          const room = roomById.get(roomId);
          const wasMixed =
            room?.genderPolicy === "mixed" || beforeGender.size > 1;
          if (!wasMixed && afterGender.size > 1) {
            for (const occupantId of afterOccupants)
              requiredConsents.add(occupantId);
          }
        }

        const roomVersions = Object.fromEntries(
          [...affectedRoomIds].map((roomId) => [
            roomId,
            roomById.get(roomId)?.compositionVersion ?? 0,
          ]),
        );
        const payload: RoomChangePayload = { moves, roomVersions };
        const id = randomUUID();
        const approved = [requesterUserId];
        const status = [...requiredConsents].every((userId) =>
          approved.includes(userId),
        )
          ? "pending"
          : "pending";
        await transaction.insert(schema.roomChangeRequests).values({
          id,
          tripId,
          requesterUserId,
          changesJson: JSON.stringify(payload),
          requiredConsentsJson: JSON.stringify([...requiredConsents].sort()),
          approvedConsentsJson: JSON.stringify(approved),
          status,
        });

        if (
          [...requiredConsents].every((userId) => approved.includes(userId))
        ) {
          await applyApprovedRequest(transaction, id, tripId, payload);
          return {
            id,
            status: "applied",
            requiredConsents: [...requiredConsents].sort(),
          };
        }
        return {
          id,
          status: "pending",
          requiredConsents: [...requiredConsents].sort(),
        };
      });
    },

    async consent(
      tripId: string,
      requestId: string,
      userId: string,
      approve: boolean,
    ) {
      return database.transaction(async (transaction) => {
        const [request] = await transaction
          .select()
          .from(schema.roomChangeRequests)
          .where(
            and(
              eq(schema.roomChangeRequests.id, requestId),
              eq(schema.roomChangeRequests.tripId, tripId),
            ),
          )
          .limit(1);
        if (!request) throw new RoomingError("request_not_found");
        if (request.status !== "pending")
          throw new RoomingError("request_not_pending");
        const required = JSON.parse(request.requiredConsentsJson) as string[];
        if (!required.includes(userId))
          throw new RoomingError("consent_not_required");
        if (!approve) {
          await transaction
            .update(schema.roomChangeRequests)
            .set({ status: "rejected", updatedAt: new Date() })
            .where(eq(schema.roomChangeRequests.id, requestId));
          return { status: "rejected" as const };
        }
        const approved = new Set(
          JSON.parse(request.approvedConsentsJson) as string[],
        );
        approved.add(userId);
        const payload = JSON.parse(request.changesJson) as RoomChangePayload;
        if (required.every((requiredUserId) => approved.has(requiredUserId))) {
          try {
            await applyApprovedRequest(transaction, requestId, tripId, payload);
          } catch (error) {
            if (
              !(error instanceof RoomingError) ||
              error.code !== "room_composition_changed"
            )
              throw error;
            await transaction
              .update(schema.roomChangeRequests)
              .set({
                status: "stale",
                approvedConsentsJson: JSON.stringify([...approved]),
                updatedAt: new Date(),
              })
              .where(eq(schema.roomChangeRequests.id, requestId));
            return { status: "stale" as const };
          }
          return { status: "applied" as const };
        }
        await transaction
          .update(schema.roomChangeRequests)
          .set({
            approvedConsentsJson: JSON.stringify([...approved]),
            updatedAt: new Date(),
          })
          .where(eq(schema.roomChangeRequests.id, requestId));
        return { status: "pending" as const };
      });
    },
  };
}
