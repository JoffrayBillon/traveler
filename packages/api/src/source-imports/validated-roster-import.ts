import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { ValidatedRosterRow } from "../source-import/types";
import { cancelMissingValidatedRegistrations } from "./cancel-missing-validated-registrations";
import { DuplicateNormalizedEmailError } from "./errors";
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

    const cancelledCount = await cancelMissingValidatedRegistrations(
      transaction,
      tripId,
      previousActiveRows,
      incomingReferences,
      activeUserIds,
      now,
    );
    return {
      created: registriesToInsert.length,
      updated: registriesToUpdate.length,
      cancelled: cancelledCount,
    };
  });
}
