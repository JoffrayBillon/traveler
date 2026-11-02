import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";

export async function getTripTransportView(
  database: AppDatabase,
  tripId: string,
  userId: string,
  isStaff: boolean,
) {
  const groups = await database
    .select()
    .from(schema.transportGroups)
    .where(eq(schema.transportGroups.tripId, tripId))
    .orderBy(asc(schema.transportGroups.name), asc(schema.transportGroups.id));
  const assignments = await database
    .select({
      groupId: schema.transportGroupAssignments.groupId,
      userId: schema.transportGroupAssignments.userId,
      firstName: schema.travelerProfiles.firstName,
      lastName: schema.travelerProfiles.lastName,
      membershipFirstName: schema.tripMemberships.firstName,
      membershipLastName: schema.tripMemberships.lastName,
      email: schema.users.email,
    })
    .from(schema.transportGroupAssignments)
    .innerJoin(
      schema.tripMemberships,
      and(
        eq(
          schema.tripMemberships.tripId,
          schema.transportGroupAssignments.tripId,
        ),
        eq(
          schema.tripMemberships.userId,
          schema.transportGroupAssignments.userId,
        ),
      ),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.tripMemberships.userId))
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
      ),
    )
    .where(eq(schema.transportGroupAssignments.tripId, tripId));
  const segments = await database
    .select()
    .from(schema.transportGroupSegments)
    .where(eq(schema.transportGroupSegments.tripId, tripId))
    .orderBy(
      asc(schema.transportGroupSegments.groupId),
      asc(schema.transportGroupSegments.direction),
      asc(schema.transportGroupSegments.position),
    );
  const members = await database
    .select({
      userId: schema.tripMemberships.userId,
      role: schema.tripMemberships.role,
      firstName: schema.travelerProfiles.firstName,
      lastName: schema.travelerProfiles.lastName,
      membershipFirstName: schema.tripMemberships.firstName,
      membershipLastName: schema.tripMemberships.lastName,
      email: schema.users.email,
      transportChoice: schema.travelerDetails.transportChoice,
      carpoolRole: schema.travelerDetails.carpoolRole,
      carpoolDriverUserId: schema.travelerDetails.carpoolDriverUserId,
      groupId: schema.transportGroupAssignments.groupId,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.tripMemberships.userId))
    .leftJoin(
      schema.travelerProfiles,
      and(
        eq(schema.travelerProfiles.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerProfiles.userId, schema.tripMemberships.userId),
      ),
    )
    .leftJoin(
      schema.travelerDetails,
      and(
        eq(schema.travelerDetails.tripId, schema.tripMemberships.tripId),
        eq(schema.travelerDetails.userId, schema.tripMemberships.userId),
      ),
    )
    .leftJoin(
      schema.transportGroupAssignments,
      and(
        eq(
          schema.transportGroupAssignments.tripId,
          schema.tripMemberships.tripId,
        ),
        eq(
          schema.transportGroupAssignments.userId,
          schema.tripMemberships.userId,
        ),
      ),
    )
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.role, "traveler"),
      ),
    );
  const visibleMembers = isStaff
    ? members
    : members.filter((member) => member.userId === userId);
  const drivers = members.filter(
    (member) =>
      member.transportChoice === "none" && member.carpoolRole === "driver",
  );
  const assignedByGroup = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const current = assignedByGroup.get(assignment.groupId) ?? [];
    current.push(assignment);
    assignedByGroup.set(assignment.groupId, current);
  }
  const segmentsByGroup = new Map<string, typeof segments>();
  for (const segment of segments) {
    const current = segmentsByGroup.get(segment.groupId) ?? [];
    current.push(segment);
    segmentsByGroup.set(segment.groupId, current);
  }
  const member = visibleMembers[0];
  const carpoolCounts = new Map<string, number>();
  for (const traveler of members) {
    if (traveler.carpoolRole === "passenger" && traveler.carpoolDriverUserId)
      carpoolCounts.set(
        traveler.carpoolDriverUserId,
        (carpoolCounts.get(traveler.carpoolDriverUserId) ?? 0) + 1,
      );
  }
  return {
    groups: groups
      .filter(
        (group) =>
          isStaff ||
          assignments.some(
            (assignment) =>
              assignment.userId === userId && assignment.groupId === group.id,
          ),
      )
      .map((group) => ({
        ...group,
        segments: segmentsByGroup.get(group.id) ?? [],
        travelers: isStaff
          ? (assignedByGroup.get(group.id) ?? []).map((assignment) => ({
              userId: assignment.userId,
              firstName: assignment.firstName ?? assignment.membershipFirstName,
              lastName: assignment.lastName ?? assignment.membershipLastName,
              email: assignment.email,
            }))
          : [],
      })),
    participants: isStaff
      ? members.map((person) => ({
          userId: person.userId,
          firstName: person.firstName ?? person.membershipFirstName,
          lastName: person.lastName ?? person.membershipLastName,
          email: person.email,
          transportChoice: person.transportChoice ?? "unconfirmed",
          groupId: person.groupId,
          carpoolRole: person.carpoolRole,
          carpoolDriverUserId: person.carpoolDriverUserId,
          passengerCount: carpoolCounts.get(person.userId) ?? 0,
        }))
      : [],
    drivers: drivers.map((driver) => ({
      userId: driver.userId,
      firstName: driver.firstName ?? driver.membershipFirstName,
      lastName: driver.lastName ?? driver.membershipLastName,
      passengerCount: carpoolCounts.get(driver.userId) ?? 0,
    })),
    self: member
      ? {
          transportChoice: member.transportChoice ?? "unconfirmed",
          groupId: member.groupId,
          carpoolRole: member.carpoolRole,
          carpoolDriverUserId: member.carpoolDriverUserId,
        }
      : null,
  };
}

export type TransportGroupSaveInput = {
  name: string;
  sourceCity: string;
  outboundMeetingAt: string | null;
  outboundMeetingPlace: string | null;
  returnMeetingAt: string | null;
  returnMeetingPlace: string | null;
  segments: {
    id?: string;
    direction: "outbound" | "return";
    mode: "train" | "flight";
    origin: string;
    destination: string;
    departureAt: string | null;
    arrivalAt: string | null;
    serviceReference: string | null;
  }[];
};

export async function saveTransportGroup(
  database: AppDatabase,
  tripId: string,
  input: TransportGroupSaveInput,
  groupId?: string,
) {
  return database.transaction(async (transaction) => {
    const id = groupId ?? randomUUID();
    if (groupId) {
      const [existing] = await transaction
        .select({ id: schema.transportGroups.id })
        .from(schema.transportGroups)
        .where(
          and(
            eq(schema.transportGroups.tripId, tripId),
            eq(schema.transportGroups.id, groupId),
          ),
        )
        .limit(1);
      if (!existing) return { error: "not_found" as const };
    }

    const existingSegments = await transaction
      .select({ id: schema.transportGroupSegments.id })
      .from(schema.transportGroupSegments)
      .where(
        and(
          eq(schema.transportGroupSegments.tripId, tripId),
          eq(schema.transportGroupSegments.groupId, id),
        ),
      );
    const existingIds = new Set(existingSegments.map((segment) => segment.id));
    if (
      input.segments.some(
        (segment) => segment.id && !existingIds.has(segment.id),
      )
    )
      return { error: "invalid_segment" as const };
    const groupValues = {
      name: input.name,
      sourceCity: input.sourceCity,
      normalizedCity: normalizeTransportCity(input.sourceCity),
      outboundMeetingAt: input.outboundMeetingAt,
      outboundMeetingPlace: input.outboundMeetingPlace,
      returnMeetingAt: input.returnMeetingAt,
      returnMeetingPlace: input.returnMeetingPlace,
      isDraft: isDraftGroup(input),
      updatedAt: new Date(),
    };
    if (groupId) {
      await transaction
        .update(schema.transportGroups)
        .set(groupValues)
        .where(
          and(
            eq(schema.transportGroups.tripId, tripId),
            eq(schema.transportGroups.id, groupId),
          ),
        );
    } else {
      await transaction.insert(schema.transportGroups).values({
        id,
        tripId,
        ...groupValues,
      });
    }
    const keptIds = new Set(
      input.segments.flatMap((segment) => segment.id ?? []),
    );
    const removedIds = [...existingIds].filter(
      (segmentId) => !keptIds.has(segmentId),
    );
    if (removedIds.length)
      await transaction
        .delete(schema.transportGroupSegments)
        .where(inArray(schema.transportGroupSegments.id, removedIds));
    for (const [position, segment] of input.segments.entries()) {
      if (!segment.id) continue;
      await transaction
        .update(schema.transportGroupSegments)
        .set({ position: position + 1000 })
        .where(
          and(
            eq(schema.transportGroupSegments.tripId, tripId),
            eq(schema.transportGroupSegments.groupId, id),
            eq(schema.transportGroupSegments.id, segment.id),
          ),
        );
    }
    for (const [position, segment] of input.segments.entries()) {
      const { id: segmentId, ...segmentValues } = segment;
      if (segmentId) {
        await transaction
          .update(schema.transportGroupSegments)
          .set({ ...segmentValues, position })
          .where(
            and(
              eq(schema.transportGroupSegments.tripId, tripId),
              eq(schema.transportGroupSegments.groupId, id),
              eq(schema.transportGroupSegments.id, segmentId),
            ),
          );
      } else {
        await transaction.insert(schema.transportGroupSegments).values({
          id: randomUUID(),
          tripId,
          groupId: id,
          position,
          ...segmentValues,
        });
      }
    }
    const [saved] = await transaction
      .select()
      .from(schema.transportGroups)
      .where(
        and(
          eq(schema.transportGroups.tripId, tripId),
          eq(schema.transportGroups.id, id),
        ),
      )
      .limit(1);
    return { group: saved };
  });
}

export function normalizeTransportCity(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR");
}

export async function setParticipantTransport(
  database: AppDatabase,
  tripId: string,
  userId: string,
  choice: "group" | "none" | "unconfirmed",
  groupId: string | null,
  assignedBy: string,
) {
  return database.transaction(async (transaction) => {
    const [membership] = await transaction
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    if (membership?.role !== "traveler")
      return { error: "traveler_not_found" as const };
    if ((choice === "group") !== Boolean(groupId))
      return { error: "invalid_transport_assignment" as const };
    if (groupId) {
      const [group] = await transaction
        .select({ id: schema.transportGroups.id })
        .from(schema.transportGroups)
        .where(
          and(
            eq(schema.transportGroups.tripId, tripId),
            eq(schema.transportGroups.id, groupId),
          ),
        )
        .limit(1);
      if (!group) return { error: "transport_group_not_found" as const };
    }
    const [current] = await transaction
      .select({ carpoolRole: schema.travelerDetails.carpoolRole })
      .from(schema.travelerDetails)
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, userId),
        ),
      )
      .limit(1);
    await transaction
      .delete(schema.transportGroupAssignments)
      .where(
        and(
          eq(schema.transportGroupAssignments.tripId, tripId),
          eq(schema.transportGroupAssignments.userId, userId),
        ),
      );
    if (groupId)
      await transaction.insert(schema.transportGroupAssignments).values({
        tripId,
        groupId,
        userId,
        assignedBy,
      });
    const role = choice === "none" ? (current?.carpoolRole ?? "none") : "none";
    await transaction
      .insert(schema.travelerDetails)
      .values({
        tripId,
        userId,
        transportMode: choice === "none" ? "none" : null,
        transportChoice: choice,
        carpoolRole: role,
        carpoolDriverUserId: null,
        departureCity: null,
        outboundDateTime: null,
        outboundMeetingTime: null,
        outboundDepartureTime: null,
        outboundLocation: null,
        outboundReference: null,
        outboundSeat: null,
        returnDateTime: null,
        returnMeetingTime: null,
        returnDepartureTime: null,
        returnLocation: null,
        returnReference: null,
        returnSeat: null,
        carpoolPreference: null,
        parkingPreference: null,
      })
      .onConflictDoUpdate({
        target: [schema.travelerDetails.tripId, schema.travelerDetails.userId],
        set: {
          transportChoice: choice,
          transportMode: choice === "none" ? "none" : null,
          carpoolRole: role,
          carpoolDriverUserId: null,
          departureCity: null,
          outboundDateTime: null,
          outboundMeetingTime: null,
          outboundDepartureTime: null,
          outboundLocation: null,
          outboundReference: null,
          outboundSeat: null,
          returnDateTime: null,
          returnMeetingTime: null,
          returnDepartureTime: null,
          returnLocation: null,
          returnReference: null,
          returnSeat: null,
          carpoolPreference: null,
          parkingPreference: null,
          updatedAt: new Date(),
        },
      });
    if (current?.carpoolRole === "driver" && role !== "driver")
      await transaction
        .update(schema.travelerDetails)
        .set({
          carpoolRole: "undecided",
          carpoolDriverUserId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            eq(schema.travelerDetails.carpoolDriverUserId, userId),
            eq(schema.travelerDetails.carpoolRole, "passenger"),
          ),
        );
    return { status: "saved" as const };
  });
}

export async function saveCarpoolRole(
  database: AppDatabase,
  tripId: string,
  userId: string,
  role: "none" | "driver" | "passenger",
  driverUserId: string | null,
) {
  return database.transaction(async (transaction) => {
    const [membership] = await transaction
      .select({ role: schema.tripMemberships.role })
      .from(schema.tripMemberships)
      .where(
        and(
          eq(schema.tripMemberships.tripId, tripId),
          eq(schema.tripMemberships.userId, userId),
        ),
      )
      .limit(1);
    if (membership?.role !== "traveler")
      return { error: "traveler_not_found" as const };
    const [details] = await transaction
      .select({
        transportChoice: schema.travelerDetails.transportChoice,
        carpoolRole: schema.travelerDetails.carpoolRole,
      })
      .from(schema.travelerDetails)
      .where(
        and(
          eq(schema.travelerDetails.tripId, tripId),
          eq(schema.travelerDetails.userId, userId),
        ),
      )
      .limit(1);
    if (details?.transportChoice !== "none")
      return { error: "carpool_requires_no_transport" as const };
    if (role === "passenger") {
      if (!driverUserId || driverUserId === userId)
        return { error: "invalid_carpool_driver" as const };
      const [driver] = await transaction
        .select({ userId: schema.tripMemberships.userId })
        .from(schema.travelerDetails)
        .innerJoin(
          schema.tripMemberships,
          and(
            eq(schema.tripMemberships.tripId, schema.travelerDetails.tripId),
            eq(schema.tripMemberships.userId, schema.travelerDetails.userId),
          ),
        )
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            eq(schema.travelerDetails.userId, driverUserId),
            eq(schema.travelerDetails.transportChoice, "none"),
            eq(schema.travelerDetails.carpoolRole, "driver"),
            eq(schema.tripMemberships.role, "traveler"),
          ),
        )
        .limit(1);
      if (!driver) return { error: "invalid_carpool_driver" as const };
    } else if (driverUserId) {
      return { error: "invalid_carpool_driver" as const };
    }
    if (details?.carpoolRole === "driver" && role !== "driver")
      await transaction
        .update(schema.travelerDetails)
        .set({
          carpoolRole: "undecided",
          carpoolDriverUserId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            eq(schema.travelerDetails.carpoolDriverUserId, userId),
            eq(schema.travelerDetails.carpoolRole, "passenger"),
          ),
        );
    await transaction
      .insert(schema.travelerDetails)
      .values({
        tripId,
        userId,
        transportMode: "none",
        transportChoice: "none",
        carpoolRole: role,
        carpoolDriverUserId: role === "passenger" ? driverUserId : null,
      })
      .onConflictDoUpdate({
        target: [schema.travelerDetails.tripId, schema.travelerDetails.userId],
        set: {
          transportMode: "none",
          transportChoice: "none",
          carpoolRole: role,
          carpoolDriverUserId: role === "passenger" ? driverUserId : null,
          updatedAt: new Date(),
        },
      });
    return { status: "saved" as const };
  });
}

export async function deleteTransportGroup(
  database: AppDatabase,
  tripId: string,
  groupId: string,
) {
  const [group] = await database
    .select({ id: schema.transportGroups.id })
    .from(schema.transportGroups)
    .where(
      and(
        eq(schema.transportGroups.tripId, tripId),
        eq(schema.transportGroups.id, groupId),
      ),
    )
    .limit(1);
  if (!group) return { error: "not_found" as const };
  const [assignment] = await database
    .select({ userId: schema.transportGroupAssignments.userId })
    .from(schema.transportGroupAssignments)
    .where(
      and(
        eq(schema.transportGroupAssignments.tripId, tripId),
        eq(schema.transportGroupAssignments.groupId, groupId),
      ),
    )
    .limit(1);
  if (assignment) return { error: "transport_group_has_travelers" as const };
  await database
    .delete(schema.transportGroups)
    .where(
      and(
        eq(schema.transportGroups.tripId, tripId),
        eq(schema.transportGroups.id, groupId),
      ),
    );
  return { status: "deleted" as const };
}

function isDraftGroup(input: TransportGroupSaveInput) {
  return (
    !input.outboundMeetingAt ||
    !input.outboundMeetingPlace?.trim() ||
    !input.returnMeetingAt ||
    !input.returnMeetingPlace?.trim() ||
    !input.segments.some((segment) => segment.direction === "outbound") ||
    !input.segments.some((segment) => segment.direction === "return")
  );
}
