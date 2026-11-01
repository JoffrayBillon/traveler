import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { DetailedOrderRow } from "../source-import/types";
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
