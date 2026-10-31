import { randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import type { AppDatabase } from "./auth";
import { normalizeEmail } from "./email";
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
  const emails = participants.map((participant) =>
    normalizeEmail(participant.email),
  );
  const normalizedEmails = emails;
  const existingUsers = emails.length
    ? await database
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(
          or(
            ...normalizedEmails.map((email) =>
              eq(sql<string>`lower(${schema.users.email})`, email),
            ),
          ),
        )
    : [];
  const userByEmail = new Map<string, string>();
  const duplicateEmails = new Set<string>();
  for (const user of existingUsers) {
    const email = normalizeEmail(user.email);
    if (userByEmail.has(email) && userByEmail.get(email) !== user.id) {
      duplicateEmails.add(email);
    } else {
      userByEmail.set(email, user.id);
    }
  }
  for (const email of duplicateEmails) {
    const participant = participants.find(
      (item) => normalizeEmail(item.email) === email,
    );
    errors.push({
      row: participant?.row ?? 1,
      field: "Email",
      message:
        "Plusieurs comptes utilisent cette adresse sans tenir compte des majuscules. Corrigez les comptes avant de relancer l’import.",
    });
  }
  const rooms = await database
    .select({
      id: schema.rooms.id,
      name: schema.rooms.name,
      capacity: schema.rooms.capacity,
      genderPolicy: schema.rooms.genderPolicy,
      compositionVersion: schema.rooms.compositionVersion,
    })
    .from(schema.rooms)
    .where(eq(schema.rooms.tripId, tripId));
  const roomByName = new Map(
    rooms.map((room) => [room.name.trim().toLocaleLowerCase("fr-FR"), room]),
  );
  const roomById = new Map(rooms.map((room) => [room.id, room]));
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
  const projectedGendersByRoom = new Map(
    [...occupantsByRoom].map(([roomId, occupants]) => [
      roomId,
      occupants.map((occupant) => ({ ...occupant })),
    ]),
  );
  const changedGenderRoomRows = new Map<string, number>();
  for (const participant of participants) {
    const existingUserId = userByEmail.get(normalizeEmail(participant.email));
    const assignedRoomId = existingUserId
      ? assignmentByUser.get(existingUserId)
      : undefined;
    if (!existingUserId || !assignedRoomId) continue;
    const occupants = projectedGendersByRoom.get(assignedRoomId) ?? [];
    const occupant = occupants.find(
      (person) => person.userId === existingUserId,
    );
    if (occupant && occupant.gender !== participant.gender) {
      occupant.gender = participant.gender;
      projectedGendersByRoom.set(assignedRoomId, occupants);
      changedGenderRoomRows.set(assignedRoomId, participant.row);
    }
  }
  for (const [roomId, row] of changedGenderRoomRows) {
    const room = roomById.get(roomId);
    const genders = new Set(
      (projectedGendersByRoom.get(roomId) ?? [])
        .map((person) => person.gender)
        .filter((gender): gender is "M" | "F" => gender !== null),
    );
    if (room && room.genderPolicy !== "mixed" && genders.size > 1) {
      errors.push({
        row,
        field: "Genre",
        message:
          "Cette modification rendrait la chambre mixte et nécessite le consentement des personnes concernées.",
      });
    }
  }
  for (const participant of participants) {
    const existingUserId = userByEmail.get(normalizeEmail(participant.email));
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
    if (existingUserId && assignmentByUser.has(existingUserId)) continue;
    const currentOccupants = projectedGendersByRoom.get(room.id) ?? [];
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

  let result: { created: number; updated: number; assigned: number };
  try {
    result = await database.transaction(async (transaction) => {
      let created = 0;
      let updated = 0;
      let assigned = 0;
      const changedRoomIds = new Set(changedGenderRoomRows.keys());
      for (const participant of participants) {
        const [existingUser] = await transaction
          .select({ id: schema.users.id, email: schema.users.email })
          .from(schema.users)
          .where(
            eq(
              sql<string>`lower(${schema.users.email})`,
              normalizeEmail(participant.email),
            ),
          )
          .limit(1);
        const userId = existingUser?.id ?? randomUUID();
        const now = new Date();
        if (!existingUser) {
          await transaction.insert(schema.users).values({
            id: userId,
            name: `${participant.firstName} ${participant.lastName}`,
            email: normalizeEmail(participant.email),
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
          });
        } else if (existingUser.email !== normalizeEmail(participant.email)) {
          await transaction
            .update(schema.users)
            .set({ email: normalizeEmail(participant.email), updatedAt: now })
            .where(eq(schema.users.id, existingUser.id));
        }
        const [membership] = await transaction
          .select({
            id: schema.tripMemberships.id,
            role: schema.tripMemberships.role,
            gender: schema.tripMemberships.gender,
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
          if (membership.gender !== participant.gender) {
            const [assignment] = await transaction
              .select({ roomId: schema.roomAssignments.roomId })
              .from(schema.roomAssignments)
              .where(
                and(
                  eq(schema.roomAssignments.tripId, tripId),
                  eq(schema.roomAssignments.userId, userId),
                ),
              )
              .limit(1);
            if (assignment) changedRoomIds.add(assignment.roomId);
          }
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
          outboundReference: isNoTransport
            ? null
            : participant.outboundReference,
          outboundSeat: isNoTransport ? null : participant.outboundSeat,
          returnDateTime: null,
          returnTimezone: null,
          returnMeetingTime: isNoTransport
            ? null
            : participant.returnMeetingTime,
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
          outboundReference: isNoTransport
            ? null
            : participant.outboundReference,
          outboundSeat: isNoTransport ? null : participant.outboundSeat,
          returnMeetingTime: isNoTransport
            ? null
            : participant.returnMeetingTime,
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
            changedRoomIds.add(importedRoom.id);
          }
        }
      }
      for (const roomId of changedRoomIds) {
        const occupants = await transaction
          .select({ gender: schema.tripMemberships.gender })
          .from(schema.roomAssignments)
          .innerJoin(
            schema.tripMemberships,
            and(
              eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
              eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
            ),
          )
          .where(
            and(
              eq(schema.roomAssignments.tripId, tripId),
              eq(schema.roomAssignments.roomId, roomId),
            ),
          );
        const genders = new Set(
          occupants
            .map((occupant) => occupant.gender)
            .filter((gender): gender is "M" | "F" => gender !== null),
        );
        const genderPolicy =
          genders.size === 0
            ? "unset"
            : genders.size > 1
              ? "mixed"
              : "single_gender";
        const roomSnapshot = roomById.get(roomId);
        // Roll back the whole import if a room changed after preflight.
        const [updatedRoom] = roomSnapshot
          ? await transaction
              .update(schema.rooms)
              .set({
                compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
                genderPolicy,
              })
              .where(
                and(
                  eq(schema.rooms.tripId, tripId),
                  eq(schema.rooms.id, roomId),
                  eq(
                    schema.rooms.compositionVersion,
                    roomSnapshot.compositionVersion,
                  ),
                ),
              )
              .returning({ id: schema.rooms.id })
          : [];
        if (!updatedRoom) throw new RoomCompositionChangedError();
      }
      return { created, updated, assigned };
    });
  } catch (error) {
    if (!(error instanceof RoomCompositionChangedError)) throw error;
    return {
      created: 0,
      updated: 0,
      assigned: 0,
      errors: [
        {
          row: 1,
          field: "ChambreInitiale",
          message:
            "La composition d’une chambre a changé pendant l’import. Vérifiez le rooming puis relancez l’import.",
        },
      ],
    };
  }
  return { ...result, errors: [] as ParticipantImportError[] };
}

class RoomCompositionChangedError extends Error {}
