import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "./auth";
import { normalizeEmail } from "./email";
import * as schema from "./schema";

export async function getImportBaselineHash(
  database: AppDatabase,
  tripId: string,
) {
  const [registrations, members, assignments, seats] = await Promise.all([
    database
      .select({
        reference: schema.tripRegistrations.reference,
        status: schema.tripRegistrations.status,
        updatedAt: schema.tripRegistrations.updatedAt,
      })
      .from(schema.tripRegistrations)
      .where(eq(schema.tripRegistrations.tripId, tripId))
      .orderBy(schema.tripRegistrations.reference),
    database
      .select({
        userId: schema.tripMemberships.userId,
        role: schema.tripMemberships.role,
        firstName: schema.tripMemberships.firstName,
        lastName: schema.tripMemberships.lastName,
      })
      .from(schema.tripMemberships)
      .where(eq(schema.tripMemberships.tripId, tripId))
      .orderBy(schema.tripMemberships.userId),
    database
      .select({
        userId: schema.roomAssignments.userId,
        roomId: schema.roomAssignments.roomId,
      })
      .from(schema.roomAssignments)
      .where(eq(schema.roomAssignments.tripId, tripId))
      .orderBy(schema.roomAssignments.userId),
    database
      .select({
        userId: schema.travelerDetails.userId,
        outboundSeat: schema.travelerDetails.outboundSeat,
        returnSeat: schema.travelerDetails.returnSeat,
      })
      .from(schema.travelerDetails)
      .where(eq(schema.travelerDetails.tripId, tripId))
      .orderBy(schema.travelerDetails.userId),
  ]);
  return createHash("sha256")
    .update(JSON.stringify([registrations, members, assignments, seats]))
    .digest("hex");
}

import type {
  AgencyRoomingRow,
  DetailedOrderRow,
  StaffImportRow,
  ValidatedRosterRow,
} from "./source-import";
import { normalizePersonName } from "./source-import";

export async function previewValidatedRoster(
  database: AppDatabase,
  tripId: string,
  rows: ValidatedRosterRow[],
) {
  const existing = await database
    .select({
      reference: schema.tripRegistrations.reference,
      status: schema.tripRegistrations.status,
      sourceEmail: schema.tripRegistrations.sourceEmail,
      firstName: schema.tripRegistrations.firstName,
      lastName: schema.tripRegistrations.lastName,
      gender: schema.tripRegistrations.gender,
      activityProfile: schema.tripRegistrations.activityProfile,
      paymentStatus: schema.tripRegistrations.paymentStatus,
      amountPaidMinor: schema.tripRegistrations.amountPaidMinor,
      amountDueMinor: schema.tripRegistrations.amountDueMinor,
    })
    .from(schema.tripRegistrations)
    .where(eq(schema.tripRegistrations.tripId, tripId));
  const byReference = new Map(existing.map((row) => [row.reference, row]));
  const incoming = new Set(rows.map((row) => row.reference));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const changes: {
    reference: string;
    action: "added" | "updated" | "unchanged";
    fields: string[];
  }[] = [];
  for (const row of rows) {
    const current = byReference.get(row.reference);
    if (!current || current.status === "cancelled") {
      added += 1;
      changes.push({
        reference: row.reference,
        action: "added",
        fields: ["Inscription", "Paiement"],
      });
      continue;
    }
    const fields: string[] = [];
    if (current.sourceEmail !== row.email) fields.push("E-mail");
    if (
      current.firstName !== row.firstName ||
      current.lastName !== row.lastName
    )
      fields.push("Identité");
    if (row.gender !== null && current.gender !== row.gender)
      fields.push("Sexe prérempli");
    if (current.activityProfile !== row.activityProfile) fields.push("Formule");
    if (
      row.paymentStatus !== null &&
      current.paymentStatus !== row.paymentStatus
    )
      fields.push("Paiement");
    if (
      row.amountPaidMinor !== null &&
      current.amountPaidMinor !== row.amountPaidMinor
    )
      fields.push("Montants réglé / dû");
    if (
      row.amountDueMinor !== null &&
      current.amountDueMinor !== row.amountDueMinor &&
      !fields.includes("Montants réglé / dû")
    )
      fields.push("Montants réglé / dû");
    const changed = current.status !== "validated" || fields.length > 0;
    if (changed) {
      updated += 1;
      if (current.status !== "validated") fields.push("Réactivation");
      changes.push({ reference: row.reference, action: "updated", fields });
    } else {
      unchanged += 1;
      changes.push({
        reference: row.reference,
        action: "unchanged",
        fields: [],
      });
    }
  }
  const removedRows = existing.filter(
    (row) => row.status === "validated" && !incoming.has(row.reference),
  );
  const removed = removedRows.length;
  const missingDetail = rows.filter((row) => !byReference.has(row.reference));
  return {
    added,
    updated,
    unchanged,
    removed,
    missingDetail: missingDetail.length,
    changes: [
      ...changes,
      ...removedRows.map((row) => ({
        reference: row.reference,
        action: "removed" as const,
        fields: ["Annulation", "Libération de chambre si applicable"],
      })),
    ],
  };
}

export async function previewDetailedOrders(
  database: AppDatabase,
  tripId: string,
  rows: DetailedOrderRow[],
) {
  const existing = await database
    .select({ reference: schema.tripRegistrations.reference })
    .from(schema.tripRegistrations)
    .where(eq(schema.tripRegistrations.tripId, tripId));
  const refs = new Set(existing.map(({ reference }) => reference));
  return {
    added: rows.filter((row) => !refs.has(row.reference)).length,
    updated: rows.filter((row) => refs.has(row.reference)).length,
    orders: rows.length,
    changes: rows.map((row) => ({
      reference: row.reference,
      action: refs.has(row.reference) ? "enriched" : "new_detail",
      fields: [
        "Formule",
        ...(row.skiDayThree ? ["3e jour de ski"] : []),
        ...(row.transportMode === "train"
          ? ["Transport", row.departureCity ?? ""]
          : ["Sans transport"]),
      ],
    })),
  };
}

export async function importDetailedOrders(
  database: AppDatabase,
  tripId: string,
  rows: DetailedOrderRow[],
) {
  const now = new Date();
  return database.transaction(async (transaction) => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const [current] = await transaction
        .select({
          id: schema.tripRegistrations.id,
          status: schema.tripRegistrations.status,
          sourceEmail: schema.tripRegistrations.sourceEmail,
          firstName: schema.tripRegistrations.firstName,
          lastName: schema.tripRegistrations.lastName,
          gender: schema.tripRegistrations.gender,
          activityProfile: schema.tripRegistrations.activityProfile,
          paymentStatus: schema.tripRegistrations.paymentStatus,
          lastImportedAt: schema.tripRegistrations.lastImportedAt,
        })
        .from(schema.tripRegistrations)
        .where(
          and(
            eq(schema.tripRegistrations.tripId, tripId),
            eq(schema.tripRegistrations.reference, row.reference),
          ),
        )
        .limit(1);
      const values = {
        sourceEmail:
          current?.lastImportedAt === null || !current
            ? normalizeEmail(row.email)
            : current.sourceEmail,
        firstName:
          current?.lastImportedAt === null || !current
            ? row.firstName
            : current.firstName,
        lastName:
          current?.lastImportedAt === null || !current
            ? row.lastName
            : current.lastName,
        sourcePhone: row.phone,
        gender: current?.gender ?? row.gender,
        activityProfile: current?.activityProfile ?? row.activityProfile,
        skiDayThree: row.skiDayThree,
        transportMode: row.transportMode,
        departureCity: row.departureCity,
        paymentStatus: current?.paymentStatus ?? row.paymentStatus,
        updatedAt: now,
      };
      if (current) {
        await transaction
          .update(schema.tripRegistrations)
          .set({
            ...values,
            status:
              current.status === "cancelled"
                ? "cancelled"
                : current.status === "validated"
                  ? "validated"
                  : row.bookingStatus,
          })
          .where(eq(schema.tripRegistrations.id, current.id));
        updated += 1;
      } else {
        await transaction.insert(schema.tripRegistrations).values({
          id: randomUUID(),
          tripId,
          reference: row.reference,
          userId: null,
          status: row.bookingStatus,
          ...values,
        });
        created += 1;
      }
    }
    return { created, updated };
  });
}

export async function importValidatedRoster(
  database: AppDatabase,
  tripId: string,
  rows: ValidatedRosterRow[],
) {
  const now = new Date();
  return database.transaction(async (transaction) => {
    const existingRows = await transaction
      .select({
        id: schema.tripRegistrations.id,
        reference: schema.tripRegistrations.reference,
        userId: schema.tripRegistrations.userId,
        status: schema.tripRegistrations.status,
        paymentStatus: schema.tripRegistrations.paymentStatus,
        amountPaidMinor: schema.tripRegistrations.amountPaidMinor,
        amountDueMinor: schema.tripRegistrations.amountDueMinor,
        gender: schema.tripRegistrations.gender,
        activityProfile: schema.tripRegistrations.activityProfile,
        skiDayThree: schema.tripRegistrations.skiDayThree,
        transportMode: schema.tripRegistrations.transportMode,
        departureCity: schema.tripRegistrations.departureCity,
      })
      .from(schema.tripRegistrations)
      .where(eq(schema.tripRegistrations.tripId, tripId));
    const registrationByReference = new Map(
      existingRows.map((row) => [row.reference, row]),
    );
    const incomingReferences = new Set(rows.map((row) => row.reference));
    const previousActiveRows = existingRows.filter(
      (row) => row.status === "validated",
    );
    const activeUserIds = new Set(
      previousActiveRows
        .filter((row) => incomingReferences.has(row.reference) && row.userId)
        .map((row) => row.userId as string),
    );
    const usersByEmail = new Map<string, { id: string; email: string }>();
    const emailCandidates = [
      ...new Set(rows.map((row) => normalizeEmail(row.email))),
    ];
    if (emailCandidates.length) {
      const users = await transaction
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(
          inArray(sql<string>`lower(${schema.users.email})`, emailCandidates),
        );
      for (const user of users) {
        const email = normalizeEmail(user.email);
        if (usersByEmail.has(email)) throw new DuplicateNormalizedEmailError();
        usersByEmail.set(email, user);
      }
    }
    const existingMemberships = await transaction
      .select({
        id: schema.tripMemberships.id,
        userId: schema.tripMemberships.userId,
        role: schema.tripMemberships.role,
        firstName: schema.tripMemberships.firstName,
        lastName: schema.tripMemberships.lastName,
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
      })
      .from(schema.tripMemberships)
      .where(eq(schema.tripMemberships.tripId, tripId));
    const membershipByUser = new Map(
      existingMemberships.map((membership) => [membership.userId, membership]),
    );
    const detailsByUser = new Map<
      string,
      typeof schema.travelerDetails.$inferSelect
    >();
    const existingUserIds = existingMemberships.map(({ userId }) => userId);
    if (existingUserIds.length) {
      const details = await transaction
        .select()
        .from(schema.travelerDetails)
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            inArray(schema.travelerDetails.userId, existingUserIds),
          ),
        );
      for (const detail of details) detailsByUser.set(detail.userId, detail);
    }

    const registriesToInsert: (typeof schema.tripRegistrations.$inferInsert)[] =
      [];
    const registriesToUpdate: {
      id: string;
      row: ValidatedRosterRow;
      userId: string;
    }[] = [];
    const usersToInsert: (typeof schema.users.$inferInsert)[] = [];
    const membershipsToInsert: (typeof schema.tripMemberships.$inferInsert)[] =
      [];
    const membershipsToUpdate: { id: string; row: ValidatedRosterRow }[] = [];
    const detailsToInsert: (typeof schema.travelerDetails.$inferInsert)[] = [];
    const detailsToUpdate: {
      userId: string;
      activityProfile: "ski" | "spa";
    }[] = [];

    for (const row of rows) {
      const existingRegistration = registrationByReference.get(row.reference);
      let userId =
        existingRegistration?.userId ??
        usersByEmail.get(normalizeEmail(row.email))?.id;
      if (!userId) {
        userId = randomUUID();
        usersByEmail.set(normalizeEmail(row.email), {
          id: userId,
          email: normalizeEmail(row.email),
        });
        usersToInsert.push({
          id: userId,
          name: `${row.firstName} ${row.lastName}`,
          email: normalizeEmail(row.email),
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (existingRegistration)
        registriesToUpdate.push({ id: existingRegistration.id, row, userId });
      else
        registriesToInsert.push({
          id: randomUUID(),
          tripId,
          reference: row.reference,
          userId,
          status: "validated",
          sourceEmail: normalizeEmail(row.email),
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender,
          activityProfile: row.activityProfile,
          paymentStatus: row.paymentStatus,
          amountPaidMinor: row.amountPaidMinor,
          amountDueMinor: row.amountDueMinor,
          lastImportedAt: now,
          createdAt: now,
          updatedAt: now,
        });

      const membership = membershipByUser.get(userId);
      if (membership) membershipsToUpdate.push({ id: membership.id, row });
      else {
        const inserted = {
          id: randomUUID(),
          tripId,
          userId,
          role: "traveler" as const,
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender,
          genderConfirmed: false,
        };
        membershipsToInsert.push(inserted);
        membershipByUser.set(userId, inserted);
      }

      const detail = detailsByUser.get(userId);
      if (detail)
        detailsToUpdate.push({ userId, activityProfile: row.activityProfile });
      else
        detailsToInsert.push({
          tripId,
          userId,
          activityProfile: row.activityProfile,
          skiDayThree: existingRegistration?.skiDayThree ?? false,
          transportMode: existingRegistration?.transportMode ?? null,
          departureCity: existingRegistration?.departureCity ?? null,
          updatedAt: now,
        });
      activeUserIds.add(userId);
    }

    for (const user of usersToInsert)
      await transaction.insert(schema.users).values(user);
    for (const membership of membershipsToInsert)
      await transaction.insert(schema.tripMemberships).values(membership);
    for (const { id, row, userId } of registriesToUpdate) {
      const current = existingRows.find(
        (registration) => registration.id === id,
      );
      await transaction
        .update(schema.tripRegistrations)
        .set({
          userId,
          status: "validated",
          sourceEmail: normalizeEmail(row.email),
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender,
          activityProfile: row.activityProfile,
          paymentStatus: row.paymentStatus ?? current?.paymentStatus ?? null,
          amountPaidMinor:
            row.amountPaidMinor ?? current?.amountPaidMinor ?? null,
          amountDueMinor: row.amountDueMinor ?? current?.amountDueMinor ?? null,
          lastImportedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.tripRegistrations.id, id));
    }
    for (const registration of registriesToInsert)
      await transaction.insert(schema.tripRegistrations).values(registration);

    for (const { id, row } of membershipsToUpdate) {
      const current = existingMemberships.find(
        (membership) => membership.id === id,
      );
      await transaction
        .update(schema.tripMemberships)
        .set({
          firstName: row.firstName,
          lastName: row.lastName,
          ...(current?.genderConfirmed || row.gender === null
            ? {}
            : { gender: row.gender }),
        })
        .where(eq(schema.tripMemberships.id, id));
    }
    for (const detail of detailsToInsert)
      await transaction.insert(schema.travelerDetails).values(detail);
    for (const detail of detailsToUpdate) {
      await transaction
        .update(schema.travelerDetails)
        .set({ activityProfile: detail.activityProfile, updatedAt: now })
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            eq(schema.travelerDetails.userId, detail.userId),
          ),
        );
    }

    const cancelledRegistrations = previousActiveRows.filter(
      (row) => !incomingReferences.has(row.reference),
    );
    const cancelledUserIds = new Set(
      cancelledRegistrations
        .map(({ userId }) => userId)
        .filter((id): id is string => Boolean(id)),
    );
    for (const registration of cancelledRegistrations) {
      await transaction
        .update(schema.tripRegistrations)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(schema.tripRegistrations.tripId, tripId),
            eq(schema.tripRegistrations.reference, registration.reference),
          ),
        );
    }
    for (const userId of cancelledUserIds) {
      const remainsActive = await transaction
        .select({ id: schema.tripRegistrations.id })
        .from(schema.tripRegistrations)
        .where(
          and(
            eq(schema.tripRegistrations.tripId, tripId),
            eq(schema.tripRegistrations.userId, userId),
            eq(schema.tripRegistrations.status, "validated"),
          ),
        )
        .limit(1);
      if (remainsActive.length || activeUserIds.has(userId)) continue;
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
      const priorAssignments = await transaction
        .select({ roomId: schema.roomAssignments.roomId })
        .from(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.userId, userId),
          ),
        );
      await transaction
        .delete(schema.roomAssignments)
        .where(
          and(
            eq(schema.roomAssignments.tripId, tripId),
            eq(schema.roomAssignments.userId, userId),
          ),
        );
      for (const { roomId } of priorAssignments) {
        const remainingGenders = await transaction
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
          remainingGenders
            .map(({ gender }) => gender)
            .filter((gender): gender is "M" | "F" => gender !== null),
        );
        const genderPolicy =
          genders.size === 0
            ? "unset"
            : genders.size > 1
              ? "mixed"
              : "single_gender";
        await transaction
          .update(schema.rooms)
          .set({
            genderPolicy,
            compositionVersion: sql`${schema.rooms.compositionVersion} + 1`,
          })
          .where(
            and(eq(schema.rooms.tripId, tripId), eq(schema.rooms.id, roomId)),
          );
      }
      if (!membership || membership.role === "traveler") {
        await transaction
          .delete(schema.tripMemberships)
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              eq(schema.tripMemberships.userId, userId),
            ),
          );
      }
    }
    return {
      created: registriesToInsert.length,
      updated: registriesToUpdate.length,
      cancelled: cancelledRegistrations.length,
    };
  });
}

export async function previewStaffImport(
  database: AppDatabase,
  tripId: string,
  rows: StaffImportRow[],
) {
  const emails = [...new Set(rows.map((row) => normalizeEmail(row.email)))];
  const existing = emails.length
    ? await database
        .select({
          userId: schema.tripMemberships.userId,
          email: schema.users.email,
          role: schema.tripMemberships.role,
        })
        .from(schema.tripMemberships)
        .innerJoin(
          schema.users,
          eq(schema.tripMemberships.userId, schema.users.id),
        )
        .where(
          and(
            eq(schema.tripMemberships.tripId, tripId),
            inArray(sql<string>`lower(${schema.users.email})`, emails),
          ),
        )
    : [];
  const byEmail = new Map(
    existing.map((row) => [normalizeEmail(row.email), row]),
  );
  const availableMembers = await database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: schema.tripMemberships.firstName,
      lastName: schema.tripMemberships.lastName,
      email: schema.users.email,
      role: schema.tripMemberships.role,
    })
    .from(schema.tripMemberships)
    .innerJoin(schema.users, eq(schema.tripMemberships.userId, schema.users.id))
    .where(eq(schema.tripMemberships.tripId, tripId))
    .orderBy(schema.tripMemberships.lastName, schema.tripMemberships.firstName);
  return {
    rows: rows.map((row) => ({
      row: row.row,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      proposedRole: row.role,
      isVip: row.isVip,
      existingRole: byEmail.get(normalizeEmail(row.email))?.role ?? null,
      action: byEmail.has(normalizeEmail(row.email)) ? "update" : "create",
    })),
    availableMembers,
  };
}

export async function importStaffRows(
  database: AppDatabase,
  tripId: string,
  rows: StaffImportRow[],
  managerEmails: string[],
  accountMappings: Record<string, string>,
) {
  const normalizedManagerEmails = new Set(managerEmails.map(normalizeEmail));
  const now = new Date();
  return database.transaction(async (transaction) => {
    const emails = [...new Set(rows.map((row) => normalizeEmail(row.email)))];
    const mappedTargetValues = Object.values(accountMappings);
    if (new Set(mappedTargetValues).size !== mappedTargetValues.length)
      throw new InvalidStaffAccountMappingError();
    const existingUsers = emails.length
      ? await transaction
          .select({
            id: schema.users.id,
            email: schema.users.email,
            name: schema.users.name,
          })
          .from(schema.users)
          .where(inArray(sql<string>`lower(${schema.users.email})`, emails))
      : [];
    const mappedUserIds = [...new Set(Object.values(accountMappings))];
    const mappedUsers = mappedUserIds.length
      ? await transaction
          .select({
            id: schema.users.id,
            email: schema.users.email,
            name: schema.users.name,
          })
          .from(schema.tripMemberships)
          .innerJoin(
            schema.users,
            eq(schema.tripMemberships.userId, schema.users.id),
          )
          .where(
            and(
              eq(schema.tripMemberships.tripId, tripId),
              inArray(schema.users.id, mappedUserIds),
            ),
          )
      : [];
    const userByEmail = new Map<string, (typeof existingUsers)[number]>();
    const userById = new Map(mappedUsers.map((user) => [user.id, user]));
    for (const user of existingUsers) {
      const email = normalizeEmail(user.email);
      if (userByEmail.has(email)) throw new DuplicateNormalizedEmailError();
      userByEmail.set(email, user);
    }
    const existingMemberships = await transaction
      .select({
        id: schema.tripMemberships.id,
        userId: schema.tripMemberships.userId,
        role: schema.tripMemberships.role,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
      })
      .from(schema.tripMemberships)
      .where(eq(schema.tripMemberships.tripId, tripId));
    const membershipByUser = new Map(
      existingMemberships.map((membership) => [membership.userId, membership]),
    );
    const detailsByUser = new Map<
      string,
      typeof schema.travelerDetails.$inferSelect
    >();
    const existingUserIds = existingMemberships.map(({ userId }) => userId);
    if (existingUserIds.length) {
      const details = await transaction
        .select()
        .from(schema.travelerDetails)
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            inArray(schema.travelerDetails.userId, existingUserIds),
          ),
        );
      for (const detail of details) detailsByUser.set(detail.userId, detail);
    }
    const usersToInsert: (typeof schema.users.$inferInsert)[] = [];
    const membershipsToInsert: (typeof schema.tripMemberships.$inferInsert)[] =
      [];
    const insertedDetails: (typeof schema.travelerDetails.$inferInsert)[] = [];
    let updated = 0;
    let created = 0;
    for (const row of rows) {
      const email = normalizeEmail(row.email);
      let user = accountMappings[email]
        ? userById.get(accountMappings[email] ?? "")
        : userByEmail.get(email);
      if (accountMappings[email] && !user)
        throw new InvalidStaffAccountMappingError();
      if (!user) {
        const id = randomUUID();
        user = { id, email, name: `${row.firstName} ${row.lastName}` };
        userByEmail.set(email, user);
        usersToInsert.push({
          id,
          email,
          name: user.name,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      const membership = membershipByUser.get(user.id);
      const role: "manager" | "companion" | "traveler" =
        normalizedManagerEmails.has(email) ? "manager" : row.role;
      if (membership) {
        await transaction
          .update(schema.tripMemberships)
          .set({
            firstName: row.firstName,
            lastName: row.lastName,
            gender: membership.genderConfirmed ? undefined : row.gender,
            role: membership.role === "manager" ? "manager" : role,
            isVip: row.isVip,
          })
          .where(eq(schema.tripMemberships.id, membership.id));
        updated += 1;
      } else {
        const newMembership = {
          id: randomUUID(),
          tripId,
          userId: user.id,
          role,
          isVip: row.isVip,
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender,
          genderConfirmed: false,
        };
        membershipsToInsert.push(newMembership);
        membershipByUser.set(user.id, newMembership);
        created += 1;
      }
      const currentDetails = detailsByUser.get(user.id);
      if (currentDetails) {
        await transaction
          .update(schema.travelerDetails)
          .set({
            activityProfile: row.activityProfile,
            skiDayThree: row.skiDayThree,
            transportMode: row.transportMode,
            departureCity: row.departureCity,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.travelerDetails.tripId, tripId),
              eq(schema.travelerDetails.userId, user.id),
            ),
          );
      } else {
        insertedDetails.push({
          tripId,
          userId: user.id,
          activityProfile: row.activityProfile,
          skiDayThree: row.skiDayThree,
          transportMode: row.transportMode,
          departureCity: row.departureCity,
          updatedAt: now,
        });
      }
    }
    for (const user of usersToInsert)
      await transaction.insert(schema.users).values(user);
    for (const membership of membershipsToInsert)
      await transaction.insert(schema.tripMemberships).values(membership);
    for (const details of insertedDetails)
      await transaction.insert(schema.travelerDetails).values(details);
    return { created, updated };
  });
}

export async function previewAgencyRooming(
  database: AppDatabase,
  tripId: string,
  rows: AgencyRoomingRow[],
) {
  const members = await database
    .select({
      userId: schema.tripMemberships.userId,
      firstName: sql<string>`coalesce(${schema.travelerProfiles.firstName}, ${schema.tripMemberships.firstName})`,
      lastName: sql<string>`coalesce(${schema.travelerProfiles.lastName}, ${schema.tripMemberships.lastName})`,
      outboundSeat: schema.travelerDetails.outboundSeat,
      returnSeat: schema.travelerDetails.returnSeat,
    })
    .from(schema.tripMemberships)
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
    .where(eq(schema.tripMemberships.tripId, tripId));
  const byName = new Map<string, (typeof members)[number][]>();
  for (const member of members) {
    const key = normalizePersonName(member.firstName, member.lastName);
    byName.set(key, [...(byName.get(key) ?? []), member]);
  }
  const matches = rows.map((row) => {
    const candidates =
      byName.get(normalizePersonName(row.firstName, row.lastName)) ?? [];
    return {
      ...row,
      userId: candidates.length === 1 ? candidates[0]?.userId : null,
      matchCount: candidates.length,
      previousOutboundSeat:
        candidates.length === 1 ? candidates[0]?.outboundSeat : null,
      previousReturnSeat:
        candidates.length === 1 ? candidates[0]?.returnSeat : null,
    };
  });
  return {
    rows: matches,
    matched: matches.filter((row) => row.matchCount === 1).length,
    unmatched: matches.filter((row) => row.matchCount === 0).length,
    ambiguous: matches.filter((row) => row.matchCount > 1).length,
    outboundPlacements: rows.filter((row) => row.outboundSeat).length,
    returnPlacements: rows.filter((row) => row.returnSeat).length,
  };
}

export async function importAgencyRooming(
  database: AppDatabase,
  tripId: string,
  rows: AgencyRoomingRow[],
) {
  const preview = await previewAgencyRooming(database, tripId, rows);
  if (preview.unmatched || preview.ambiguous)
    throw new InvalidAgencyRoomingMatchError();
  const now = new Date();
  return database.transaction(async (transaction) => {
    let updated = 0;
    for (const row of preview.rows) {
      if (!row.userId) continue;
      const values = {
        ...(row.outboundSeat === null
          ? {}
          : { outboundSeat: row.outboundSeat }),
        ...(row.returnSeat === null ? {} : { returnSeat: row.returnSeat }),
        updatedAt: now,
      };
      if (row.outboundSeat === null && row.returnSeat === null) continue;
      const [existing] = await transaction
        .select({ userId: schema.travelerDetails.userId })
        .from(schema.travelerDetails)
        .where(
          and(
            eq(schema.travelerDetails.tripId, tripId),
            eq(schema.travelerDetails.userId, row.userId),
          ),
        )
        .limit(1);
      if (existing) {
        await transaction
          .update(schema.travelerDetails)
          .set(values)
          .where(
            and(
              eq(schema.travelerDetails.tripId, tripId),
              eq(schema.travelerDetails.userId, row.userId),
            ),
          );
      } else {
        await transaction.insert(schema.travelerDetails).values({
          tripId,
          userId: row.userId,
          activityProfile: null,
          skiDayThree: false,
          transportMode: null,
          departureCity: null,
          ...values,
        });
      }
      updated += 1;
    }
    return { updated };
  });
}

export class InvalidAgencyRoomingMatchError extends Error {}

export class DuplicateNormalizedEmailError extends Error {}
export class InvalidStaffAccountMappingError extends Error {}
