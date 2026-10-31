import { randomUUID } from "node:crypto";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
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
  const uniqueEmails = [...new Set(emails)];
  const existingUsers = emails.length
    ? await database
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(inArray(sql<string>`lower(${schema.users.email})`, uniqueEmails))
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
    if (currentOccupants.length + 1 > room.capacity) {
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
    currentOccupants.push({
      userId: existingUserId ?? `new:${participant.email}`,
      gender: participant.gender,
    });
    projectedGendersByRoom.set(room.id, currentOccupants);
  }
  if (errors.length) return { errors, created: 0, updated: 0, assigned: 0 };

  let result: { created: number; updated: number; assigned: number };
  try {
    result = await database.transaction(async (transaction) => {
      let created = 0;
      let updated = 0;
      let assigned = 0;
      const changedRoomIds = new Set(changedGenderRoomRows.keys());
      const now = new Date();
      const transactionUsers = uniqueEmails.length
        ? await transaction
            .select({ id: schema.users.id, email: schema.users.email })
            .from(schema.users)
            .where(
              inArray(sql<string>`lower(${schema.users.email})`, uniqueEmails),
            )
        : [];
      const userIdByEmail = new Map<string, string>();
      const userById = new Map(transactionUsers.map((user) => [user.id, user]));
      for (const user of transactionUsers) {
        const email = normalizeEmail(user.email);
        if (userIdByEmail.has(email)) throw new DuplicateNormalizedEmailError();
        userIdByEmail.set(email, user.id);
      }
      const userIds = transactionUsers.map((user) => user.id);
      const transactionMemberships = userIds.length
        ? await transaction
            .select({
              id: schema.tripMemberships.id,
              userId: schema.tripMemberships.userId,
              firstName: schema.tripMemberships.firstName,
              lastName: schema.tripMemberships.lastName,
              gender: schema.tripMemberships.gender,
            })
            .from(schema.tripMemberships)
            .where(
              and(
                eq(schema.tripMemberships.tripId, tripId),
                inArray(schema.tripMemberships.userId, userIds),
              ),
            )
        : [];
      const membershipByUserId = new Map(
        transactionMemberships.map((membership) => [
          membership.userId,
          membership,
        ]),
      );
      const transactionAssignments = userIds.length
        ? await transaction
            .select({
              userId: schema.roomAssignments.userId,
              roomId: schema.roomAssignments.roomId,
            })
            .from(schema.roomAssignments)
            .where(
              and(
                eq(schema.roomAssignments.tripId, tripId),
                inArray(schema.roomAssignments.userId, userIds),
              ),
            )
        : [];
      const assignmentRoomByUserId = new Map(
        transactionAssignments.map((assignment) => [
          assignment.userId,
          assignment.roomId,
        ]),
      );
      const usersToInsert: (typeof schema.users.$inferInsert)[] = [];
      const usersToNormalize: { id: string; email: string }[] = [];
      const membershipsToInsert: (typeof schema.tripMemberships.$inferInsert)[] =
        [];
      const membershipsToUpdate: {
        id: string;
        firstName: string;
        lastName: string;
        gender: "M" | "F";
      }[] = [];
      const detailsToUpsert: (typeof schema.travelerDetails.$inferInsert)[] =
        [];
      const assignmentsToInsert: (typeof schema.roomAssignments.$inferInsert)[] =
        [];

      for (const participant of participants) {
        const email = normalizeEmail(participant.email);
        let userId = userIdByEmail.get(email);
        if (!userId) {
          userId = randomUUID();
          userIdByEmail.set(email, userId);
          usersToInsert.push({
            id: userId,
            name: `${participant.firstName} ${participant.lastName}`,
            email,
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          const existingUser = userById.get(userId);
          if (existingUser && existingUser.email !== email) {
            usersToNormalize.push({ id: userId, email });
          }
        }
        const membership = membershipByUserId.get(userId);
        if (membership) {
          membershipsToUpdate.push({
            id: membership.id,
            firstName: participant.firstName,
            lastName: participant.lastName,
            gender: participant.gender,
          });
          if (membership.gender !== participant.gender) {
            const assignedRoomId = assignmentRoomByUserId.get(userId);
            if (assignedRoomId) changedRoomIds.add(assignedRoomId);
          }
          updated += 1;
        } else {
          const newMembership = {
            id: randomUUID(),
            tripId,
            userId,
            role: "traveler" as const,
            firstName: participant.firstName,
            lastName: participant.lastName,
            gender: participant.gender,
          };
          membershipsToInsert.push(newMembership);
          membershipByUserId.set(userId, newMembership);
          created += 1;
        }

        const isNoTransport = participant.transportMode === "none";
        const importedDetails = {
          tripId,
          userId,
          activityProfile: participant.activityProfile,
          skiDayThree: participant.skiDayThree,
          transportMode: participant.transportMode,
          departureCity: isNoTransport ? null : participant.departureCity,
          outboundDateTime: null as string | null,
          outboundTimezone: null as string | null,
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
          returnDateTime: null as string | null,
          returnTimezone: null as string | null,
          returnMeetingTime: isNoTransport
            ? null
            : participant.returnMeetingTime,
          returnDepartureTime: isNoTransport
            ? null
            : participant.returnDepartureTime,
          returnReference: isNoTransport ? null : participant.returnReference,
          returnSeat: isNoTransport ? null : participant.returnSeat,
          outboundLocation: null as string | null,
          returnLocation: null as string | null,
          carpoolPreference: null as boolean | null,
          parkingPreference: null as boolean | null,
          updatedAt: now,
        };
        detailsToUpsert.push(importedDetails);

        if (participant.initialRoomName) {
          const importedRoom = roomByName.get(
            participant.initialRoomName.toLocaleLowerCase("fr-FR"),
          );
          if (importedRoom && !assignmentRoomByUserId.has(userId)) {
            assignmentsToInsert.push({
              id: randomUUID(),
              tripId,
              roomId: importedRoom.id,
              userId,
            });
            assignmentRoomByUserId.set(userId, importedRoom.id);
            assigned += 1;
            changedRoomIds.add(importedRoom.id);
          }
        }
      }

      for (const chunk of chunks(usersToInsert, 50)) {
        await transaction.insert(schema.users).values(chunk);
      }
      for (const chunk of chunks(usersToNormalize, 50)) {
        await transaction
          .update(schema.users)
          .set({
            email: caseById(schema.users.id, chunk, "email"),
            updatedAt: now,
          })
          .where(
            inArray(
              schema.users.id,
              chunk.map(({ id }) => id),
            ),
          );
      }
      for (const chunk of chunks(membershipsToInsert, 50)) {
        await transaction.insert(schema.tripMemberships).values(chunk);
      }
      for (const chunk of chunks(membershipsToUpdate, 50)) {
        await transaction
          .update(schema.tripMemberships)
          .set({
            firstName: caseById(schema.tripMemberships.id, chunk, "firstName"),
            lastName: caseById(schema.tripMemberships.id, chunk, "lastName"),
            gender: caseById(schema.tripMemberships.id, chunk, "gender"),
          })
          .where(
            inArray(
              schema.tripMemberships.id,
              chunk.map(({ id }) => id),
            ),
          );
      }

      for (const chunk of chunks(detailsToUpsert, 25)) {
        const noTransportIds = chunk
          .filter((details) => details.transportMode === "none")
          .map(({ userId }) => userId);
        const transportIds = chunk
          .filter((details) => details.transportMode !== "none")
          .map(({ userId }) => userId);
        await transaction
          .insert(schema.travelerDetails)
          .values(chunk)
          .onConflictDoUpdate({
            target: [
              schema.travelerDetails.tripId,
              schema.travelerDetails.userId,
            ],
            set: {
              activityProfile: sql`excluded.activity_profile`,
              skiDayThree: sql`excluded.ski_day_three`,
              transportMode: sql`excluded.transport_mode`,
              departureCity: sql`excluded.departure_city`,
              outboundMeetingTime: sql`excluded.outbound_meeting_time`,
              outboundDepartureTime: sql`excluded.outbound_departure_time`,
              outboundReference: sql`excluded.outbound_reference`,
              outboundSeat: sql`excluded.outbound_seat`,
              returnMeetingTime: sql`excluded.return_meeting_time`,
              returnDepartureTime: sql`excluded.return_departure_time`,
              returnReference: sql`excluded.return_reference`,
              returnSeat: sql`excluded.return_seat`,
              outboundDateTime: preserveOrClearByUserId(
                schema.travelerDetails.outboundDateTime,
                noTransportIds,
              ),
              outboundTimezone: preserveOrClearByUserId(
                schema.travelerDetails.outboundTimezone,
                noTransportIds,
              ),
              outboundLocation: preserveOrClearByUserId(
                schema.travelerDetails.outboundLocation,
                noTransportIds,
              ),
              returnDateTime: preserveOrClearByUserId(
                schema.travelerDetails.returnDateTime,
                noTransportIds,
              ),
              returnTimezone: preserveOrClearByUserId(
                schema.travelerDetails.returnTimezone,
                noTransportIds,
              ),
              returnLocation: preserveOrClearByUserId(
                schema.travelerDetails.returnLocation,
                noTransportIds,
              ),
              carpoolPreference: preserveOrClearByUserId(
                schema.travelerDetails.carpoolPreference,
                transportIds,
              ),
              parkingPreference: preserveOrClearByUserId(
                schema.travelerDetails.parkingPreference,
                transportIds,
              ),
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
      for (const chunk of chunks(assignmentsToInsert, 50)) {
        await transaction.insert(schema.roomAssignments).values(chunk);
      }

      const affectedRooms = [...changedRoomIds].map((roomId) => {
        const roomSnapshot = roomById.get(roomId);
        if (!roomSnapshot) throw new RoomCompositionChangedError();
        const genders = new Set(
          (projectedGendersByRoom.get(roomId) ?? [])
            .map((occupant) => occupant.gender)
            .filter((gender): gender is "M" | "F" => gender !== null),
        );
        const genderPolicy =
          genders.size === 0
            ? "unset"
            : genders.size > 1
              ? "mixed"
              : "single_gender";
        return {
          id: roomId,
          compositionVersion: roomSnapshot.compositionVersion,
          genderPolicy,
        };
      });
      for (const chunk of chunks(affectedRooms, 50)) {
        const updatedRooms = await transaction
          .update(schema.rooms)
          .set({
            compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
            genderPolicy: caseById(schema.rooms.id, chunk, "genderPolicy"),
          })
          .where(
            and(
              eq(schema.rooms.tripId, tripId),
              inArray(
                schema.rooms.id,
                chunk.map(({ id }) => id),
              ),
              eq(
                schema.rooms.compositionVersion,
                caseById(schema.rooms.id, chunk, "compositionVersion"),
              ),
            ),
          )
          .returning({ id: schema.rooms.id });
        if (updatedRooms.length !== chunk.length) {
          throw new RoomCompositionChangedError();
        }
      }
      return { created, updated, assigned };
    });
  } catch (error) {
    if (error instanceof DuplicateNormalizedEmailError) {
      return {
        created: 0,
        updated: 0,
        assigned: 0,
        errors: [
          {
            row: 1,
            field: "Email",
            message:
              "Plusieurs comptes utilisent cette adresse sans tenir compte des majuscules. Corrigez les comptes avant de relancer l’import.",
          },
        ],
      };
    }
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

class DuplicateNormalizedEmailError extends Error {}

function chunks<T>(values: readonly T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function caseById<T extends { id: string }, K extends Exclude<keyof T, "id">>(
  column: SQLWrapper,
  rows: readonly T[],
  key: K,
): SQL<T[K]> {
  return sql<T[K]>`CASE ${column} ${sql.join(
    rows.map((row) => sql`WHEN ${row.id} THEN ${row[key]}`),
    sql` `,
  )} ELSE ${column} END`;
}

function preserveOrClearByUserId(column: SQLWrapper, clearUserIds: string[]) {
  if (clearUserIds.length === 0) return sql`${column}`;
  return sql`CASE WHEN ${schema.travelerDetails.userId} IN (${sql.join(
    clearUserIds.map((userId) => sql`${userId}`),
    sql`, `,
  )}) THEN NULL ELSE ${column} END`;
}
