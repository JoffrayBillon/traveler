import { eq } from "drizzle-orm";
import type { AppDatabase } from "../auth";
import * as schema from "../schema";
import type { ValidatedRosterRow } from "../source-import/types";
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
