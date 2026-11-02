import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { StaffImportRow } from "../source-import/types";
import type { DatabaseExecutor, DatabaseTransaction } from "./database.types";
import {
  DuplicateNormalizedEmailError,
  InvalidStaffAccountMappingError,
} from "./errors";
export async function previewStaffImport(
  database: DatabaseExecutor,
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
  existingTransaction?: DatabaseTransaction,
) {
  const normalizedManagerEmails = new Set(managerEmails.map(normalizeEmail));
  const now = new Date();
  const run = async (transaction: DatabaseTransaction) => {
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
  };
  return existingTransaction
    ? run(existingTransaction)
    : database.transaction(run);
}
