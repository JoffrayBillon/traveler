import { eq } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import { normalizeEmail } from "../email";
import * as schema from "../schema";
import type { ValidatedRosterRow } from "../source-import/types";
import { compareRegistrationFields } from "./registration-preview";

const fields = [
  "status",
  "sourceEmail",
  "firstName",
  "lastName",
  "gender",
  "activityProfile",
  "paymentStatus",
  "amountPaidMinor",
  "amountDueMinor",
] as const;

export async function previewValidatedRoster(
  database: AppDatabase,
  tripId: string,
  rows: ValidatedRosterRow[],
) {
  const existing = await database
    .select()
    .from(schema.tripRegistrations)
    .where(eq(schema.tripRegistrations.tripId, tripId));
  const byReference = new Map(existing.map((row) => [row.reference, row]));
  const incoming = new Set(rows.map((row) => row.reference));
  const changes = rows.map((row) => {
    const current = byReference.get(row.reference);
    const values = compareRegistrationFields(fields, current, {
      ...row,
      status: "validated",
      sourceEmail: normalizeEmail(row.email),
      paymentStatus: row.paymentStatus ?? current?.paymentStatus ?? null,
      amountPaidMinor: row.amountPaidMinor ?? current?.amountPaidMinor ?? null,
      amountDueMinor: row.amountDueMinor ?? current?.amountDueMinor ?? null,
    });
    return {
      row: row.row,
      reference: row.reference,
      firstName: row.firstName,
      lastName: row.lastName,
      action: !current ? "added" : values.length ? "updated" : "unchanged",
      values,
    };
  });
  const removed = existing.filter(
    (row) => row.status === "validated" && !incoming.has(row.reference),
  );
  return {
    added: changes.filter((row) => row.action === "added").length,
    updated: changes.filter((row) => row.action === "updated").length,
    unchanged: changes.filter((row) => row.action === "unchanged").length,
    removed: removed.length,
    missingDetail: rows.filter(
      (row) => !byReference.get(row.reference)?.transportMode,
    ).length,
    changes: [
      ...changes,
      ...removed.map((row) => ({
        row: null,
        reference: row.reference,
        firstName: row.firstName,
        lastName: row.lastName,
        action: "removed",
        values: compareRegistrationFields(["status"], row, {
          status: "cancelled",
        }),
      })),
    ],
  };
}
