import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "./auth";
import type {
  ImportedParticipant,
  ParticipantImportError,
} from "./participant-import";
import * as schema from "./schema";

export async function importParticipants(
  database: AppDatabase,
  tripId: string,
  participants: ImportedParticipant[],
) {
  const errors: ParticipantImportError[] = [];
  const emails = participants.map((participant) => participant.email);
  const existingUsers = emails.length
    ? await database
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(inArray(schema.users.email, emails))
    : [];
  const userByEmail = new Map(
    existingUsers.map((user) => [user.email, user.id]),
  );
  const rooms = await database
    .select({
      id: schema.rooms.id,
      name: schema.rooms.name,
      capacity: schema.rooms.capacity,
      genderPolicy: schema.rooms.genderPolicy,
    })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId));
  const roomByName = new Map(
    rooms.map((room) => [room.name.trim().toLocaleLowerCase("fr-FR"), room]),
  );
  const assignments = await database
    .select({
      userId: schema.roomAssignments.userId,
      roomId: schema.roomAssignments.roomId,
    })
    .from(schema.roomAssignments)
    .where(eq(schema.roomAssignments.tripId, tripId));
  const assignmentByUser = new Map(
    assignments.map((assignment) => [assignment.userId, assignment.roomId]),
  );
  const occupantsByRoom = new Map<
    string,
    { userId: string; gender: "M" | "F" | null }[]
  >();
  if (assignments.length) {
    const occupantRows = await database
      .select({
        userId: schema.tripMemberships.userId,
        roomId: schema.roomAssignments.roomId,
        gender: schema.tripMemberships.gender,
      })
      .from(schema.roomAssignments)
      .innerJoin(
        schema.tripMemberships,
        and(
          eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
          eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
        ),
      )
      .where(eq(schema.roomAssignments.tripId, tripId));
    for (const occupant of occupantRows) {
      const group = occupantsByRoom.get(occupant.roomId) ?? [];
      group.push({ userId: occupant.userId, gender: occupant.gender });
      occupantsByRoom.set(occupant.roomId, group);
    }
  }
  const projectedRoomAssignments = new Map<
    string,
    { userId: string; gender: "M" | "F" }[]
  >();
  for (const participant of participants) {
    if (!participant.initialRoomName) continue;
    const room = roomByName.get(
      participant.initialRoomName.toLocaleLowerCase("fr-FR"),
    );
    if (!room) {
      errors.push({
        row: participant.row,
        field: "ChambreInitiale",
        message: "Cette chambre n’existe pas dans le voyage.",
      });
      continue;
    }
    const existingUserId = userByEmail.get(participant.email);
    if (existingUserId && assignmentByUser.has(existingUserId)) continue;
    const currentOccupants = occupantsByRoom.get(room.id) ?? [];
    const importedOccupants = projectedRoomAssignments.get(room.id) ?? [];
    if (
      currentOccupants.length + importedOccupants.length + 1 >
      room.capacity
    ) {
      errors.push({
        row: participant.row,
        field: "ChambreInitiale",
        message: "Cette chambre dépasserait sa capacité.",
      });
      continue;
    }
    const genders = new Set(
      [
        ...currentOccupants.map((occupant) => occupant.gender),
        ...importedOccupants.map((occupant) => occupant.gender),
        participant.gender,
      ].filter((gender): gender is "M" | "F" => gender !== null),
    );
    if (room.genderPolicy === "mixed" || genders.size > 1) {
      errors.push({
        row: participant.row,
        field: "ChambreInitiale",
        message:
          "Une affectation qui rend la chambre mixte doit passer par le consentement des personnes concernées.",
      });
      continue;
    }
    importedOccupants.push({
      userId: existingUserId ?? `new:${participant.email}`,
      gender: participant.gender,
    });
    projectedRoomAssignments.set(room.id, importedOccupants);
  }
  if (errors.length) return { errors, created: 0, updated: 0, assigned: 0 };

  const result = await database.transaction(async (transaction) => {
    let created = 0;
    let updated = 0;
    let assigned = 0;
    for (const participant of participants) {
      const [existingUser] = await transaction
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, participant.email))
        .limit(1);
      const userId = existingUser?.id ?? randomUUID();
      const now = new Date();
      if (!existingUser) {
        await transaction.insert(schema.users).values({
          id: userId,
          name: `${participant.firstName} ${participant.lastName}`,
          email: participant.email,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      const [membership] = await transaction
        .select({
          id: schema.tripMemberships.id,
          role: schema.tripMemberships.role,
        })
        .from(schema.tripMemberships)
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            eq(schema.tripMemberships.userId, userId),
          ),
        )
        .limit(1);
      if (membership) {
        await transaction
          .update(schema.tripMemberships)
          .set({
            firstName: participant.firstName,
            lastName: participant.lastName,
            gender: participant.gender,
          })
          .where(eq(schema.tripMemberships.id, membership.id));
        updated += 1;
      } else {
        await transaction.insert(schema.tripMemberships).values({
          id: randomUUID(),
          tripId,
          userId,
          role: "traveler",
          firstName: participant.firstName,
          lastName: participant.lastName,
          gender: participant.gender,
        });
        created += 1;
      }

      const isNoTransport = participant.transportMode === "none";
      const importedDetails = {
        activityProfile: participant.activityProfile,
        skiDayThree: participant.skiDayThree,
        transportMode: participant.transportMode,
        departureCity: isNoTransport ? null : participant.departureCity,
        outboundDateTime: null,
        outboundTimezone: null,
        outboundMeetingTime: isNoTransport
          ? null
          : participant.outboundMeetingTime,
        outboundDepartureTime: isNoTransport
          ? null
          : participant.outboundDepartureTime,
        outboundReference: isNoTransport ? null : participant.outboundReference,
        outboundSeat: isNoTransport ? null : participant.outboundSeat,
        returnDateTime: null,
        returnTimezone: null,
        returnMeetingTime: isNoTransport ? null : participant.returnMeetingTime,
        returnDepartureTime: isNoTransport
          ? null
          : participant.returnDepartureTime,
        returnReference: isNoTransport ? null : participant.returnReference,
        returnSeat: isNoTransport ? null : participant.returnSeat,
        ...(isNoTransport
          ? { outboundLocation: null, returnLocation: null }
          : {}),
        ...(!isNoTransport
          ? { carpoolPreference: null, parkingPreference: null }
          : {}),
        updatedAt: now,
      };
      const importedUpdate = {
        activityProfile: participant.activityProfile,
        skiDayThree: participant.skiDayThree,
        transportMode: participant.transportMode,
        departureCity: isNoTransport ? null : participant.departureCity,
        outboundMeetingTime: isNoTransport
          ? null
          : participant.outboundMeetingTime,
        outboundDepartureTime: isNoTransport
          ? null
          : participant.outboundDepartureTime,
        outboundReference: isNoTransport ? null : participant.outboundReference,
        outboundSeat: isNoTransport ? null : participant.outboundSeat,
        returnMeetingTime: isNoTransport ? null : participant.returnMeetingTime,
        returnDepartureTime: isNoTransport
          ? null
          : participant.returnDepartureTime,
        returnReference: isNoTransport ? null : participant.returnReference,
        returnSeat: isNoTransport ? null : participant.returnSeat,
        ...(!isNoTransport
          ? { carpoolPreference: null, parkingPreference: null }
          : {}),
        ...(isNoTransport
          ? {
              outboundDateTime: null,
              outboundTimezone: null,
              outboundLocation: null,
              returnDateTime: null,
              returnTimezone: null,
              returnLocation: null,
            }
          : {}),
        updatedAt: now,
      };
      await transaction
        .insert(schema.travelerDetails)
        .values({ tripId, userId, ...importedDetails })
        .onConflictDoUpdate({
          target: [
            schema.travelerDetails.tripId,
            schema.travelerDetails.userId,
          ],
          set: importedUpdate,
        });

      if (participant.initialRoomName) {
        const importedRoom = roomByName.get(
          participant.initialRoomName.toLocaleLowerCase("fr-FR"),
        );
        const [currentAssignment] = await transaction
          .select({ id: schema.roomAssignments.id })
          .from(schema.roomAssignments)
          .where(
            and(
              eq(schema.roomAssignments.tripId, tripId),
              eq(schema.roomAssignments.userId, userId),
            ),
          )
          .limit(1);
        if (importedRoom && !currentAssignment) {
          await transaction.insert(schema.roomAssignments).values({
            id: randomUUID(),
            tripId,
            roomId: importedRoom.id,
            userId,
          });
          assigned += 1;
          await transaction
            .update(schema.rooms)
            .set({
              compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
              genderPolicy:
                participant.gender === "M" || participant.gender === "F"
                  ? "single_gender"
                  : "unset",
            })
            .where(
              and(
                eq(schema.rooms.tripId, tripId),
                eq(schema.rooms.id, importedRoom.id),
              ),
            );
        }
      }
    }
    return { created, updated, assigned };
  });
  return { ...result, errors: [] as ParticipantImportError[] };
}
