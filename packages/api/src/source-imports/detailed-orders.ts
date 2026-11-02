import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { DetailedOrderRow } from "../source-import/types";
import { batchRows } from "./batch-rows";
import type { DatabaseTransaction } from "./database.types";
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
  existingTransaction?: DatabaseTransaction,
) {
  const now = new Date();
  const run = async (transaction: DatabaseTransaction) => {
    const references = [...new Set(rows.map((row) => row.reference))];
    const existing = references.length
      ? await transaction
          .select()
          .from(schema.tripRegistrations)
          .where(
            and(
              eq(schema.tripRegistrations.tripId, tripId),
              inArray(schema.tripRegistrations.reference, references),
            ),
          )
      : [];
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
            paymentStatus: sql`excluded.payment_status`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
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
