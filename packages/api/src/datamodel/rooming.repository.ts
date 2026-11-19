import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import { getTripMembershipRole } from "./trip-membership.repository";

export async function getRoomingView(
  database: AppDatabase,
  tripId: string,
  userId: string,
  organizerView = false,
) {
  const actor = await getTripMembershipRole(database, tripId, userId);
  if (!actor) return null;
  const showOrganizerPlan = organizerView && actor.role !== "traveler";

  const memberships = await database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
      lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
      gender: schema.tripMemberships.gender,
    })
    .from(schema.tripMemberships)
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
      ),
    )
    .where(eq(schema.tripMemberships.tripId, tripId));
  const assignments = await database
    .select({
      roomId: schema.roomAssignments.roomId,
      userId: schema.roomAssignments.userId,
    })
    .from(schema.roomAssignments)
    .where(eq(schema.roomAssignments.tripId, tripId));
  const assignmentsByRoom = new Map<string, (typeof assignments)[number][]>();
  for (const assignment of assignments) {
    const roomAssignments = assignmentsByRoom.get(assignment.roomId) ?? [];
    roomAssignments.push(assignment);
    assignmentsByRoom.set(assignment.roomId, roomAssignments);
  }
  const rooms = await database
    .select({
      id: schema.rooms.id,
      name: schema.rooms.name,
      capacity: schema.rooms.capacity,
      isLocked: schema.rooms.isLocked,
    })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId))
    .orderBy(schema.rooms.name);
  const memberById = new Map(
    memberships.map((member) => [member.userId, member]),
  );

  const ownRoomId = assignments.find(
    (assignment) => assignment.userId === userId,
  )?.roomId;
  const ownRoomIsLocked = rooms.find((room) => room.id === ownRoomId)?.isLocked;
  const visibleRooms = showOrganizerPlan
    ? rooms
    : rooms.filter(
        (room) => room.id === ownRoomId || (!ownRoomIsLocked && !room.isLocked),
      );

  return {
    rooms: visibleRooms.map((room) => {
      const roomAssignments = assignmentsByRoom.get(room.id) ?? [];
      const occupants = roomAssignments
        .map((assignment) => memberById.get(assignment.userId))
        .filter((member) => member !== undefined);
      return {
        ...room,
        occupiedCount: roomAssignments.length,
        occupants: occupants.map(({ userId, firstName, lastName }) => ({
          userId,
          firstName,
          lastName,
        })),
        ...(showOrganizerPlan
          ? { composition: getRoomComposition(occupants) }
          : {}),
      };
    }),
    unassignedCount: showOrganizerPlan
      ? memberships.length - assignments.length
      : undefined,
  };
}

function getRoomComposition(occupants: { gender: "M" | "F" | null }[]) {
  const genders = new Set(occupants.map((occupant) => occupant.gender));
  if (genders.has("M") && genders.has("F")) return "mixed";
  if (genders.has(null)) return "unset";
  if (genders.has("M")) return "male";
  if (genders.has("F")) return "female";
  return "unset";
}

export async function getRoomingExportData(
  database: AppDatabase,
  tripId: string,
) {
  const rooms = await database
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId))
    .orderBy(schema.rooms.name, schema.rooms.id);
  const occupants = await database
    .select({
      roomId: schema.roomAssignments.roomId,
      firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
      lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
      gender: schema.tripMemberships.gender,
      email: schema.users.email,
    })
    .from(schema.roomAssignments)
    .innerJoin(
      schema.tripMemberships,
      and(
        eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
        eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
      ),
    )
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
      ),
    )
    .where(eq(schema.roomAssignments.tripId, tripId))
    .orderBy(
      schema.tripMemberships.lastName,
      schema.tripMemberships.firstName,
      schema.users.email,
    );
  return { rooms, occupants };
}
