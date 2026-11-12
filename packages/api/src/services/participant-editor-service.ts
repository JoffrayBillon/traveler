import { and, eq, sql } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { AppDatabase } from "../auth";
import {
  saveCarpoolRoleInTransaction,
  setParticipantTransportInTransaction,
} from "../datamodel/transport.repository";
import { refreshRoomComposition } from "../datamodel/traveler.repository";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import {
  updateParticipantEmailInTransaction,
  updateParticipantRoleInTransaction,
} from "./participant-management";

type ParticipantEditorTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

type ParticipantRole = "traveler" | "companion" | "manager";
type ActivityProfile = "ski" | "spa" | null;
type TransportChoice = "group" | "none" | "unconfirmed";
type CarpoolRole = "none" | "driver" | "passenger" | "undecided";

type ParticipantEditorInput = {
  profile: {
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
    dietaryRequirements: string;
    allergens: string;
    emergencyContactFirstName: string;
    emergencyContactLastName: string;
    emergencyContactPhone: string;
  };
  details: {
    activityProfile: ActivityProfile;
    skiDayThree: boolean;
    transportChoice: TransportChoice;
    groupId: string | null;
    carpoolRole: CarpoolRole;
    carpoolDriverUserId: string | null;
  };
  email?: string;
  role?: ParticipantRole;
  isVip?: boolean;
};

class ParticipantEditorError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function saveParticipantFromOrganizer(
  database: AppDatabase,
  tripId: string,
  userId: string,
  actorUserId: string,
  payload: unknown,
) {
  const input = parseParticipantEditorInput(payload);
  if (!input) return { error: "invalid_participant_editor_input" } as const;

  try {
    await database.transaction(async (transaction) => {
      await applyParticipantEditorUpdate(
        transaction,
        tripId,
        userId,
        actorUserId,
        input,
      );
    });
    return { status: "saved" } as const;
  } catch (error) {
    return {
      error:
        error instanceof ParticipantEditorError
          ? error.code
          : "participant_update_failed",
    } as const;
  }
}

async function applyParticipantEditorUpdate(
  transaction: ParticipantEditorTransaction,
  tripId: string,
  userId: string,
  actorUserId: string,
  input: ParticipantEditorInput,
) {
  const [actor] = await transaction
    .select({ role: schema.tripMemberships.role })
    .from(schema.tripMemberships)
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, actorUserId),
      ),
    )
    .limit(1);
  if (!actor) throw new ParticipantEditorError("not_found");
  if (actor.role === "traveler") throw new ParticipantEditorError("forbidden");

  const [target] = await transaction
    .select({
      role: schema.tripMemberships.role,
      gender: schema.tripMemberships.gender,
      genderConfirmed: schema.tripMemberships.genderConfirmed,
      roomId: schema.roomAssignments.roomId,
      email: schema.users.email,
      transportChoice: schema.travelerDetails.transportChoice,
      groupId: schema.transportGroupAssignments.groupId,
      carpoolRole: schema.travelerDetails.carpoolRole,
      carpoolDriverUserId: schema.travelerDetails.carpoolDriverUserId,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .leftJoin(
      schema.roomAssignments,
      and(
        eq(schema.roomAssignments.tripId, schema.tripMemberships.tripId),
        eq(schema.roomAssignments.userId, schema.tripMemberships.userId),
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
        eq(schema.tripMemberships.userId, userId),
      ),
    )
    .limit(1);
  if (!target) throw new ParticipantEditorError("not_found");

  if (actor.role === "manager") {
    if (!input.email || !input.role)
      throw new ParticipantEditorError("invalid_participant_editor_input");
    if (input.role !== target.role) {
      if (userId === actorUserId)
        throw new ParticipantEditorError("cannot_change_own_role");
      if (target.role === "manager" && input.role !== "manager") {
        const managers = await transaction
          .select({ userId: schema.tripMemberships.userId })
          .from(schema.tripMemberships)
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              eq(schema.tripMemberships.role, "manager"),
            ),
          );
        if (managers.length <= 1)
          throw new ParticipantEditorError("last_manager_required");
      }
    }
    if (normalizeEmail(target.email) !== input.email) {
      const [emailCollision] = await transaction
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            sql<string>`lower(${schema.users.email}) = ${input.email}`,
            sql`${schema.users.id} <> ${userId}`,
          ),
        )
        .limit(1);
      if (emailCollision) throw new ParticipantEditorError("email_in_use");
    }
  } else if (input.email !== undefined || input.role !== undefined) {
    throw new ParticipantEditorError("forbidden");
  }

  const currentChoice: TransportChoice = target.groupId
    ? "group"
    : (target.transportChoice ?? "unconfirmed");
  if (
    currentChoice !== input.details.transportChoice ||
    (input.details.transportChoice === "group" &&
      target.groupId !== input.details.groupId)
  ) {
    if (input.details.groupId) {
      const [group] = await transaction
        .select({ id: schema.transportGroups.id })
        .from(schema.transportGroups)
        .where(
          and(
            eq(schema.transportGroups.tripId, tripId),
            eq(schema.transportGroups.id, input.details.groupId),
          ),
        )
        .limit(1);
      if (!group) throw new ParticipantEditorError("transport_group_not_found");
    }
  }

  const parsedEmergencyPhone = input.profile.emergencyContactPhone
    ? parsePhoneNumberFromString(input.profile.emergencyContactPhone)
    : undefined;
  if (input.profile.emergencyContactPhone && !parsedEmergencyPhone?.isValid())
    throw new ParticipantEditorError("invalid_emergency_contact_phone");

  const now = new Date();
  const emergencyContactIsComplete = Boolean(
    input.profile.emergencyContactFirstName &&
      input.profile.emergencyContactLastName &&
      parsedEmergencyPhone?.isValid(),
  );

  await transaction
    .update(schema.tripMemberships)
    .set({
      firstName: input.profile.firstName,
      lastName: input.profile.lastName,
      gender: input.profile.gender,
      genderConfirmed: input.profile.gender !== null,
      ...(input.isVip === undefined ? {} : { isVip: input.isVip }),
    })
    .where(
      and(
        eq(schema.tripMemberships.tripId, tripId),
        eq(schema.tripMemberships.userId, userId),
      ),
    );
  await transaction
    .insert(schema.travelerProfiles)
    .values({
      tripId,
      userId,
      firstName: input.profile.firstName,
      lastName: input.profile.lastName,
      dietaryRequirements: input.profile.dietaryRequirements,
      allergens: input.profile.allergens,
      emergencyContactFirstName: input.profile.emergencyContactFirstName,
      emergencyContactLastName: input.profile.emergencyContactLastName,
      emergencyContactPhone: parsedEmergencyPhone?.number ?? "",
      completedAt:
        input.profile.firstName &&
        input.profile.lastName &&
        input.profile.gender !== null &&
        emergencyContactIsComplete
          ? now
          : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.travelerProfiles.tripId, schema.travelerProfiles.userId],
      set: {
        firstName: input.profile.firstName,
        lastName: input.profile.lastName,
        dietaryRequirements: input.profile.dietaryRequirements,
        allergens: input.profile.allergens,
        emergencyContactFirstName: input.profile.emergencyContactFirstName,
        emergencyContactLastName: input.profile.emergencyContactLastName,
        emergencyContactPhone: parsedEmergencyPhone?.number ?? "",
        completedAt:
          input.profile.firstName &&
          input.profile.lastName &&
          input.profile.gender !== null &&
          emergencyContactIsComplete
            ? now
            : null,
        updatedAt: now,
      },
    });

  await transaction
    .insert(schema.travelerDetails)
    .values({
      tripId,
      userId,
      activityProfile: input.details.activityProfile,
      skiDayThree: input.details.skiDayThree,
    })
    .onConflictDoUpdate({
      target: [schema.travelerDetails.tripId, schema.travelerDetails.userId],
      set: {
        activityProfile: input.details.activityProfile,
        skiDayThree: input.details.skiDayThree,
        updatedAt: now,
      },
    });

  if (
    target.roomId &&
    (target.gender !== input.profile.gender ||
      target.genderConfirmed !== (input.profile.gender !== null))
  )
    await refreshRoomComposition(transaction, tripId, target.roomId);

  if (
    currentChoice !== input.details.transportChoice ||
    (input.details.transportChoice === "group" &&
      target.groupId !== input.details.groupId)
  ) {
    const result = await setParticipantTransportInTransaction(
      transaction,
      tripId,
      userId,
      input.details.transportChoice,
      input.details.groupId,
      actorUserId,
    );
    if ("error" in result) throw new ParticipantEditorError(result.error);
  }

  if (input.details.transportChoice === "none") {
    const result = await saveCarpoolRoleInTransaction(
      transaction,
      tripId,
      userId,
      input.details.carpoolRole,
      input.details.carpoolDriverUserId,
    );
    if ("error" in result) throw new ParticipantEditorError(result.error);
  }

  if (actor.role === "manager") {
    const nextRole = input.role;
    const nextEmail = input.email;
    if (!nextRole || !nextEmail)
      throw new ParticipantEditorError("invalid_participant_editor_input");
    if (nextRole !== target.role) {
      const roleResult = await updateParticipantRoleInTransaction(
        transaction,
        tripId,
        userId,
        nextRole,
      );
      if (roleResult !== "updated")
        throw new ParticipantEditorError(roleResult);
    }
    if (normalizeEmail(target.email) !== nextEmail) {
      const emailResult = await updateParticipantEmailInTransaction(
        transaction,
        tripId,
        userId,
        nextEmail,
      );
      if (emailResult.status === "email_in_use")
        throw new ParticipantEditorError("email_in_use");
      if (emailResult.status === "not_found")
        throw new ParticipantEditorError("not_found");
    }
  }
}

function parseParticipantEditorInput(
  value: unknown,
): ParticipantEditorInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    !body.profile ||
    typeof body.profile !== "object" ||
    Array.isArray(body.profile) ||
    !body.details ||
    typeof body.details !== "object" ||
    Array.isArray(body.details)
  )
    return null;
  const profile = body.profile as Record<string, unknown>;
  const details = body.details as Record<string, unknown>;
  const firstName = optionalText(profile.firstName, 100);
  const lastName = optionalText(profile.lastName, 100);
  const dietaryRequirements = optionalText(profile.dietaryRequirements, 500);
  const allergens = optionalText(profile.allergens, 500);
  const emergencyContactFirstName = optionalText(
    profile.emergencyContactFirstName,
    100,
  );
  const emergencyContactLastName = optionalText(
    profile.emergencyContactLastName,
    100,
  );
  const emergencyContactPhone = optionalText(profile.emergencyContactPhone, 40);
  const gender = profile.gender;
  const activityProfile = details.activityProfile;
  const skiDayThree =
    details.skiDayThree === null ? false : details.skiDayThree;
  const transportChoice = details.transportChoice;
  const groupId = details.groupId;
  const carpoolRole = details.carpoolRole;
  const carpoolDriverUserId = details.carpoolDriverUserId;

  if (
    firstName === null ||
    lastName === null ||
    dietaryRequirements === null ||
    allergens === null ||
    emergencyContactFirstName === null ||
    emergencyContactLastName === null ||
    emergencyContactPhone === null ||
    (gender !== null && gender !== "M" && gender !== "F") ||
    (activityProfile !== null &&
      activityProfile !== "ski" &&
      activityProfile !== "spa") ||
    typeof skiDayThree !== "boolean" ||
    (skiDayThree && activityProfile !== "ski") ||
    (transportChoice !== null &&
      transportChoice !== "group" &&
      transportChoice !== "none" &&
      transportChoice !== "unconfirmed") ||
    (groupId !== null &&
      groupId !== undefined &&
      typeof groupId !== "string") ||
    (carpoolRole !== "none" &&
      carpoolRole !== "driver" &&
      carpoolRole !== "passenger" &&
      carpoolRole !== "undecided") ||
    (carpoolDriverUserId !== null && typeof carpoolDriverUserId !== "string")
  )
    return null;

  const email =
    body.email === undefined
      ? undefined
      : typeof body.email === "string"
        ? normalizeEmail(body.email)
        : null;
  const role = body.role;
  const isVip = body.isVip;
  if (
    email === null ||
    (email !== undefined &&
      (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
    (role !== undefined &&
      role !== "traveler" &&
      role !== "companion" &&
      role !== "manager") ||
    (isVip !== undefined && typeof isVip !== "boolean")
  )
    return null;

  const parsedTransportChoice: TransportChoice =
    transportChoice === "group" ||
    transportChoice === "none" ||
    transportChoice === "unconfirmed"
      ? transportChoice
      : "unconfirmed";
  const parsedGroupId =
    parsedTransportChoice === "group" && typeof groupId === "string"
      ? groupId
      : null;
  const parsedCarpoolRole: CarpoolRole =
    parsedTransportChoice === "none" ? (carpoolRole as CarpoolRole) : "none";
  const parsedCarpoolDriverUserId =
    parsedTransportChoice === "none" && parsedCarpoolRole === "passenger"
      ? typeof carpoolDriverUserId === "string"
        ? carpoolDriverUserId
        : null
      : null;
  if ((parsedTransportChoice === "group") !== Boolean(parsedGroupId))
    return null;
  if (parsedCarpoolRole === "passenger" && !parsedCarpoolDriverUserId)
    return null;
  if (parsedCarpoolRole !== "passenger" && carpoolDriverUserId) return null;

  return {
    profile: {
      firstName,
      lastName,
      gender: gender as "M" | "F" | null,
      dietaryRequirements,
      allergens,
      emergencyContactFirstName,
      emergencyContactLastName,
      emergencyContactPhone,
    },
    details: {
      activityProfile: activityProfile as ActivityProfile,
      skiDayThree,
      transportChoice: parsedTransportChoice,
      groupId: parsedGroupId,
      carpoolRole: parsedCarpoolRole,
      carpoolDriverUserId: parsedCarpoolDriverUserId,
    },
    ...(email !== undefined ? { email } : {}),
    ...(role !== undefined ? { role: role as ParticipantRole } : {}),
    ...(isVip !== undefined ? { isVip } : {}),
  };
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}
