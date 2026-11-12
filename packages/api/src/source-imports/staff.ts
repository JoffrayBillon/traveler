import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeTransportCity } from "../datamodel/transport.repository";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { StaffImportRow } from "../source-import/types";
import { batchRows } from "./batch-rows";
import type { DatabaseExecutor, DatabaseTransaction } from "./database.types";
import {
  DuplicateNormalizedEmailError,
  InvalidStaffAccountMappingError,
  InvalidStaffTransportMappingError,
} from "./errors";
import {
  previewStaffTransportImport,
  replaceStaffTransportAssignments,
  resolveStaffTransportGroups,
  type StaffGroupAssignment,
} from "./staff-transport";
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
  const transport = await previewStaffTransportImport(database, tripId, rows);
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
      normalizedTransportCity:
        row.transportMode === "none" || !row.departureCity
          ? null
          : normalizeTransportCity(row.departureCity),
      transportMode: row.transportMode,
    })),
    availableMembers,
    transportRows: transport.rows,
    transportSummary: {
      groupedParticipants: rows.filter((row) => row.transportMode !== "none")
        .length,
      noTransportParticipants: rows.filter(
        (row) => row.transportMode === "none",
      ).length,
      matchedGroups: transport.rows.filter((row) => row.action === "matched")
        .length,
      draftGroups: transport.rows.filter((row) => row.action === "create_draft")
        .length,
      ambiguousCities: transport.rows.filter(
        (row) => row.action === "choose_group",
      ).length,
    },
  };
}
export async function importStaffRows(
  database: AppDatabase,
  tripId: string,
  rows: StaffImportRow[],
  managerEmails: string[],
  accountMappings: Record<string, string>,
  transportMappings: Record<string, string>,
  actorUserId: string,
  existingTransaction?: DatabaseTransaction,
) {
  const normalizedManagerEmails = new Set(managerEmails.map(normalizeEmail));
  const now = new Date();
  const run = async (transaction: DatabaseTransaction) => {
    const groupIdByCity = await resolveStaffTransportGroups(
      transaction,
      tripId,
      rows,
      transportMappings,
      now,
    );
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
        gender: schema.tripMemberships.gender,
        genderConfirmed: schema.tripMemberships.genderConfirmed,
        isVip: schema.tripMemberships.isVip,
        lastLoginAt: schema.tripMemberships.lastLoginAt,
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
    const membershipsToUpdate: {
      current: (typeof existingMemberships)[number];
      row: StaffImportRow;
      role: "manager" | "companion" | "traveler";
    }[] = [];
    const insertedDetails: (typeof schema.travelerDetails.$inferInsert)[] = [];
    const detailsToUpdate: {
      current: typeof schema.travelerDetails.$inferSelect;
      row: StaffImportRow;
    }[] = [];
    const affectedUserIds: string[] = [];
    const groupAssignments: StaffGroupAssignment[] = [];
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
      affectedUserIds.push(user.id);
      if (row.transportMode !== "none") {
        if (!row.departureCity) throw new InvalidStaffTransportMappingError();
        const normalizedCity = normalizeTransportCity(row.departureCity);
        const groupId = groupIdByCity.get(normalizedCity);
        if (!groupId) throw new InvalidStaffTransportMappingError();
        groupAssignments.push({
          tripId,
          groupId,
          userId: user.id,
          assignedBy: actorUserId,
          assignedAt: now,
        });
      }
      const membership = membershipByUser.get(user.id);
      const role: "manager" | "companion" | "traveler" =
        normalizedManagerEmails.has(email) ? "manager" : row.role;
      if (membership) {
        membershipsToUpdate.push({
          current: membership,
          row,
          role: membership.role === "manager" ? "manager" : role,
        });
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
          lastLoginAt: null,
        };
        membershipsToInsert.push(newMembership);
        membershipByUser.set(user.id, newMembership);
        created += 1;
      }
      const currentDetails = detailsByUser.get(user.id);
      if (currentDetails) {
        detailsToUpdate.push({ current: currentDetails, row });
      } else {
        insertedDetails.push({
          tripId,
          userId: user.id,
          activityProfile: row.activityProfile,
          skiDayThree: row.skiDayThree,
          transportChoice:
            row.transportMode === "none"
              ? ("none" as const)
              : ("group" as const),
          transportMode:
            row.transportMode === "none" ? ("none" as const) : null,
          departureCity: null,
          updatedAt: now,
        });
      }
    }
    for (const batch of batchRows(usersToInsert))
      await transaction.insert(schema.users).values(batch);

    const membershipWrites = [
      ...membershipsToInsert,
      ...membershipsToUpdate.map(({ current, row, role }) => ({
        id: current.id,
        tripId,
        userId: current.userId,
        role,
        isVip: row.isVip,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: current.genderConfirmed ? current.gender : row.gender,
        genderConfirmed: current.genderConfirmed,
        lastLoginAt: current.lastLoginAt,
      })),
    ];
    for (const batch of batchRows(membershipWrites))
      await transaction
        .insert(schema.tripMemberships)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            schema.tripMemberships.tripId,
            schema.tripMemberships.userId,
          ],
          set: {
            role: sql`excluded.role`,
            isVip: sql`excluded.is_vip`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            gender: sql`excluded.gender`,
          },
        });

    const detailWrites = [
      ...insertedDetails,
      ...detailsToUpdate.map(({ current, row }) => ({
        ...current,
        activityProfile: row.activityProfile,
        skiDayThree: row.skiDayThree,
        transportChoice:
          row.transportMode === "none" ? ("none" as const) : ("group" as const),
        transportMode: row.transportMode === "none" ? ("none" as const) : null,
        departureCity: null,
        ...(row.transportMode === "none"
          ? {}
          : { carpoolRole: "none" as const, carpoolDriverUserId: null }),
        ...(row.transportMode === "none"
          ? {}
          : { carpoolPreference: null, parkingPreference: null }),
        updatedAt: now,
      })),
    ];
    for (const batch of batchRows(detailWrites))
      await transaction
        .insert(schema.travelerDetails)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            schema.travelerDetails.tripId,
            schema.travelerDetails.userId,
          ],
          set: {
            activityProfile: sql`excluded.activity_profile`,
            skiDayThree: sql`excluded.ski_day_three`,
            transportChoice: sql`excluded.transport_choice`,
            transportMode: sql`excluded.transport_mode`,
            departureCity: sql`excluded.departure_city`,
            carpoolRole: sql`excluded.carpool_role`,
            carpoolDriverUserId: sql`excluded.carpool_driver_user_id`,
            carpoolPreference: sql`excluded.carpool_preference`,
            parkingPreference: sql`excluded.parking_preference`,
            updatedAt: sql`excluded.updated_at`,
          },
        });

    const groupedUserIds = rows
      .flatMap((row, index) =>
        row.transportMode === "none" ? [] : [affectedUserIds[index] ?? ""],
      )
      .filter(Boolean);
    await replaceStaffTransportAssignments(
      transaction,
      tripId,
      affectedUserIds,
      groupedUserIds,
      groupAssignments,
      now,
    );
    return { created, updated };
  };
  return existingTransaction
    ? run(existingTransaction)
    : database.transaction(run);
}
