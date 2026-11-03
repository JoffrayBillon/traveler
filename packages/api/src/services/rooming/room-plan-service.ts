import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import { recordRoomAssignmentHistory } from "../../datamodel/room-assignment-history.repository";
import { getRoomInventory } from "../../datamodel/room-inventory.repository";
import { staleRoomRequestsForRooms } from "../../datamodel/room-request.repository";
import * as schema from "../../schema";

type AssignmentPlan = {
  snapshot: string;
  roomsToCreate: { id: string; name: string; capacity: number }[];
  assignments: {
    userId: string;
    firstName: string;
    lastName: string;
    gender: "M" | "F";
    roomId: string;
    roomName: string;
  }[];
  unassignedConfirmed: number;
  unconfirmed: number;
};

export function previewRoomAssignments(database: AppDatabase, tripId: string) {
  return database.transaction((transaction) =>
    buildAssignmentPlan(transaction, tripId),
  );
}

export async function applyRoomAssignmentPlan(
  database: AppDatabase,
  tripId: string,
  expectedSnapshot: string,
  actorUserId: string,
) {
  return database.transaction(async (transaction) => {
    const plan = await buildAssignmentPlan(transaction, tripId);
    if (plan.snapshot !== expectedSnapshot)
      return { error: "room_plan_changed" as const };

    if (plan.roomsToCreate.length) {
      await transaction
        .insert(schema.rooms)
        .values(plan.roomsToCreate.map((room) => ({ ...room, tripId })));
    }
    if (plan.assignments.length) {
      await transaction.insert(schema.roomAssignments).values(
        plan.assignments.map((assignment) => ({
          id: randomUUID(),
          tripId,
          roomId: assignment.roomId,
          userId: assignment.userId,
        })),
      );
    }

    if (plan.assignments.length > 0 || plan.roomsToCreate.length > 0)
      await recordRoomAssignmentHistory(
        transaction,
        tripId,
        actorUserId,
        "plan_generation",
        plan.assignments.map((assignment) => ({
          userId: assignment.userId,
          fromRoomId: null,
          toRoomId: assignment.roomId,
        })),
      );

    const touched = new Map<string, "M" | "F">();
    for (const assignment of plan.assignments)
      touched.set(assignment.roomId, assignment.gender);
    for (const roomId of touched.keys()) {
      await transaction
        .update(schema.rooms)
        .set({
          genderPolicy: "single_gender",
          compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
        })
        .where(
          and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)),
        );
    }
    if (touched.size)
      await staleRoomRequestsForRooms(transaction, tripId, [...touched.keys()]);

    return {
      status: "applied" as const,
      assigned: plan.assignments.length,
      unassignedConfirmed: plan.unassignedConfirmed,
      unconfirmed: plan.unconfirmed,
      inventoryCreated: plan.roomsToCreate.length > 0,
    };
  });
}

async function buildAssignmentPlan(
  transaction: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
  tripId: string,
): Promise<AssignmentPlan> {
  const currentRooms = await transaction
    .select({
      id: schema.rooms.id,
      name: schema.rooms.name,
      capacity: schema.rooms.capacity,
      genderPolicy: schema.rooms.genderPolicy,
      compositionVersion: schema.rooms.compositionVersion,
      isLocked: schema.rooms.isLocked,
    })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId))
    .orderBy(schema.rooms.name);
  const configuredInventory = await getRoomInventory(transaction, tripId);
  let roomNumber = 0;
  const roomsToCreate = currentRooms.length
    ? []
    : configuredInventory.flatMap(({ capacity, quantity }) =>
        Array.from({ length: quantity }, () => {
          roomNumber += 1;
          const name = String(roomNumber).padStart(2, "0");
          return {
            name,
            capacity,
            id: createHash("sha256")
              .update(`${tripId}\0room\0${name}`)
              .digest("hex"),
          };
        }),
      );
  const rooms = currentRooms.length
    ? currentRooms
    : roomsToCreate.map((room) => ({
        ...room,
        genderPolicy: "unset" as const,
        compositionVersion: 1,
        isLocked: false,
      }));
  const assignments = await transaction
    .select({
      userId: schema.roomAssignments.userId,
      roomId: schema.roomAssignments.roomId,
    })
    .from(schema.roomAssignments)
    .where(eq(schema.roomAssignments.tripId, tripId));
  const assignedIds = new Set(assignments.map(({ userId }) => userId));
  const travelers = await transaction
    .select({
      userId: schema.tripMemberships.userId,
      firstName: schema.tripMemberships.firstName,
      lastName: schema.tripMemberships.lastName,
      gender: schema.tripMemberships.gender,
      genderConfirmed: schema.tripMemberships.genderConfirmed,
    })
    .from(schema.tripMemberships)
    .where(eq(schema.tripMemberships.tripId, tripId))
    .orderBy(schema.tripMemberships.lastName, schema.tripMemberships.firstName);
  const membershipById = new Map(
    travelers.map((traveler) => [traveler.userId, traveler]),
  );
  const occupancy = new Map<string, number>();
  const roomGender = new Map<string, "M" | "F" | null>();
  const unknownOccupantRooms = new Set<string>();
  const mixedOccupantRooms = new Set<string>();
  for (const room of rooms) {
    occupancy.set(
      room.id,
      assignments.filter((assignment) => assignment.roomId === room.id).length,
    );
    roomGender.set(room.id, null);
    if (room.genderPolicy === "mixed") mixedOccupantRooms.add(room.id);
  }
  for (const assignment of assignments) {
    const member = membershipById.get(assignment.userId);
    if (!member?.genderConfirmed || !member.gender) {
      unknownOccupantRooms.add(assignment.roomId);
      continue;
    }
    const currentGender = roomGender.get(assignment.roomId);
    if (currentGender && currentGender !== member.gender) {
      mixedOccupantRooms.add(assignment.roomId);
      continue;
    }
    roomGender.set(assignment.roomId, member.gender);
  }

  const eligible = travelers.filter(
    (traveler) =>
      !assignedIds.has(traveler.userId) &&
      traveler.genderConfirmed &&
      traveler.gender !== null,
  );
  const plannedAssignments: AssignmentPlan["assignments"] = [];
  for (const traveler of eligible) {
    const target = rooms
      .filter((room) => {
        const gender = roomGender.get(room.id);
        return (
          !room.isLocked &&
          !unknownOccupantRooms.has(room.id) &&
          !mixedOccupantRooms.has(room.id) &&
          (occupancy.get(room.id) ?? 0) < room.capacity &&
          (!gender || gender === traveler.gender)
        );
      })
      .sort((left, right) => {
        const countDifference =
          (occupancy.get(right.id) ?? 0) - (occupancy.get(left.id) ?? 0);
        return countDifference || left.name.localeCompare(right.name, "fr");
      })[0];
    if (!target || !traveler.gender) continue;
    plannedAssignments.push({
      userId: traveler.userId,
      firstName: traveler.firstName,
      lastName: traveler.lastName,
      gender: traveler.gender,
      roomId: target.id,
      roomName: target.name,
    });
    occupancy.set(target.id, (occupancy.get(target.id) ?? 0) + 1);
    roomGender.set(target.id, traveler.gender);
  }

  const snapshot = createHash("sha256")
    .update(
      JSON.stringify({
        rooms: rooms.map((room) => ({
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          genderPolicy: room.genderPolicy,
          compositionVersion: room.compositionVersion,
          isLocked: room.isLocked,
        })),
        assignments: assignments
          .map(({ roomId, userId }) => ({ roomId, userId }))
          .sort((left, right) =>
            `${left.roomId}:${left.userId}`.localeCompare(
              `${right.roomId}:${right.userId}`,
            ),
          ),
        travelers: travelers.map(({ userId, gender, genderConfirmed }) => ({
          userId,
          gender,
          genderConfirmed,
        })),
      }),
    )
    .digest("hex");

  return {
    snapshot,
    roomsToCreate,
    assignments: plannedAssignments,
    unassignedConfirmed: eligible.length - plannedAssignments.length,
    unconfirmed: travelers.filter(
      (traveler) =>
        !assignedIds.has(traveler.userId) &&
        (!traveler.genderConfirmed || traveler.gender === null),
    ).length,
  };
}
