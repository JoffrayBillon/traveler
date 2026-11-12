import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeTransportCity } from "../datamodel/transport.repository";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { DetailedOrderRow } from "../source-import/types";
import { applyRegistrationTransport } from "./apply-registration-transport";
import { batchRows } from "./batch-rows";
import type { DatabaseTransaction } from "./database.types";
import { compareRegistrationFields } from "./registration-preview";
import {
  previewStaffTransportImport,
  resolveStaffTransportGroups,
} from "./staff-transport";

function getSavedTransportMappings(
  registrations: (typeof schema.tripRegistrations.$inferSelect)[],
) {
  const byCity = new Map<string, Set<string>>();
  for (const { departureCity, importedTransportGroupId } of registrations) {
    if (!departureCity || !importedTransportGroupId) continue;
    const city = normalizeTransportCity(departureCity);
    const groups = byCity.get(city) ?? new Set<string>();
    groups.add(importedTransportGroupId);
    byCity.set(city, groups);
  }
  const mappings = new Map<string, string>();
  for (const [city, groups] of byCity) {
    const [groupId] = groups;
    if (groups.size === 1 && groupId) mappings.set(city, groupId);
  }
  return mappings;
}

const fields = [
  "status",
  "sourceEmail",
  "firstName",
  "lastName",
  "sourcePhone",
  "gender",
  "activityProfile",
  "skiDayThree",
  "transportMode",
  "departureCity",
  "paymentStatus",
] as const;

export async function previewDetailedOrders(
  database: AppDatabase,
  tripId: string,
  rows: DetailedOrderRow[],
) {
  const existing = await database
    .select()
    .from(schema.tripRegistrations)
    .where(eq(schema.tripRegistrations.tripId, tripId));
  const byReference = new Map(existing.map((row) => [row.reference, row]));
  const transport = await previewStaffTransportImport(
    database,
    tripId,
    rows,
    getSavedTransportMappings(existing),
  );
  const changes = rows.map((row) => {
    const current = byReference.get(row.reference);
    const values = compareRegistrationFields(
      fields,
      current,
      detailedOrderFields(row, current),
    );
    return {
      row: row.row,
      reference: row.reference,
      firstName: row.firstName,
      lastName: row.lastName,
      action: !current
        ? "new_detail"
        : values.length
          ? "enriched"
          : "unchanged",
      values,
    };
  });
  return {
    added: changes.filter((row) => row.action === "new_detail").length,
    updated: changes.filter((row) => row.action === "enriched").length,
    unchanged: changes.filter((row) => row.action === "unchanged").length,
    orders: rows.length,
    groupedParticipants: rows.filter((row) => row.transportMode === "train")
      .length,
    noTransportParticipants: rows.filter((row) => row.transportMode === "none")
      .length,
    transportRows: transport.rows,
    changes,
  };
}

function detailedOrderFields(
  row: DetailedOrderRow,
  current: typeof schema.tripRegistrations.$inferSelect | undefined,
) {
  return {
    sourceEmail:
      !current || current.lastImportedAt === null
        ? normalizeEmail(row.email)
        : current.sourceEmail,
    firstName:
      !current || current.lastImportedAt === null
        ? row.firstName
        : current.firstName,
    lastName:
      !current || current.lastImportedAt === null
        ? row.lastName
        : current.lastName,
    sourcePhone: row.phone,
    gender: current?.gender ?? row.gender,
    activityProfile: current?.activityProfile ?? row.activityProfile,
    skiDayThree: row.skiDayThree,
    transportMode: row.transportMode,
    departureCity: row.departureCity,
    paymentStatus: current?.paymentStatus ?? row.paymentStatus,
    status: current
      ? current.status === "cancelled" || current.status === "validated"
        ? current.status
        : row.bookingStatus
      : row.bookingStatus,
  };
}

export async function importDetailedOrders(
  database: AppDatabase,
  tripId: string,
  rows: DetailedOrderRow[],
  transportMappings: Record<string, string>,
  actorUserId: string,
  existingTransaction?: DatabaseTransaction,
) {
  const now = new Date();
  const run = async (transaction: DatabaseTransaction) => {
    const existing = await transaction
      .select()
      .from(schema.tripRegistrations)
      .where(eq(schema.tripRegistrations.tripId, tripId));
    const groupByCity = await resolveStaffTransportGroups(
      transaction,
      tripId,
      rows,
      transportMappings,
      now,
      getSavedTransportMappings(existing),
    );
    const existingByReference = new Map(
      existing.map((registration) => [registration.reference, registration]),
    );
    const writes = rows.map((row) => {
      const current = existingByReference.get(row.reference);
      const registration = current ?? {
        id: randomUUID(),
        tripId,
        reference: row.reference,
        userId: null,
        status: row.bookingStatus,
        sourceEmail: normalizeEmail(row.email),
        firstName: row.firstName,
        lastName: row.lastName,
        sourcePhone: row.phone,
        gender: row.gender,
        activityProfile: row.activityProfile,
        skiDayThree: row.skiDayThree,
        transportMode: row.transportMode,
        departureCity: row.departureCity,
        paymentStatus: row.paymentStatus,
        amountPaidMinor: null,
        amountDueMinor: null,
        lastImportedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...registration,
        ...detailedOrderFields(row, current),
        importedTransportGroupId: row.departureCity
          ? (groupByCity.get(normalizeTransportCity(row.departureCity)) ?? null)
          : null,
        updatedAt: now,
      };
    });
    for (const batch of batchRows(writes))
      await transaction
        .insert(schema.tripRegistrations)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            schema.tripRegistrations.tripId,
            schema.tripRegistrations.reference,
          ],
          set: {
            status: sql`excluded.status`,
            sourceEmail: sql`excluded.source_email`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            sourcePhone: sql`excluded.source_phone`,
            gender: sql`excluded.gender`,
            activityProfile: sql`excluded.activity_profile`,
            skiDayThree: sql`excluded.ski_day_three`,
            transportMode: sql`excluded.transport_mode`,
            departureCity: sql`excluded.departure_city`,
            importedTransportGroupId: sql`excluded.imported_transport_group_id`,
            paymentStatus: sql`excluded.payment_status`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    await applyRegistrationTransport(
      transaction,
      tripId,
      writes.flatMap(({ userId }) => (userId ? [userId] : [])),
      actorUserId,
    );
    return {
      created: rows.filter((row) => !existingByReference.has(row.reference))
        .length,
      updated: rows.filter((row) => existingByReference.has(row.reference))
        .length,
    };
  };
  return existingTransaction
    ? run(existingTransaction)
    : database.transaction(run);
}
