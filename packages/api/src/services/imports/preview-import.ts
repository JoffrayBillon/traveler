import { createHash, randomUUID } from "node:crypto";
import { lte } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import * as schema from "../../schema";
import {
  getImportBaselineHash,
  previewAgencyRooming,
  previewDetailedOrders,
  previewStaffImport,
  previewValidatedRoster,
} from "../../source-imports";
import type { ImportSourceType } from "./import-source";
import { parseImportSource } from "./import-source";

export async function previewImportSource(
  database: AppDatabase,
  tripId: string,
  actorUserId: string,
  sourceType: ImportSourceType,
  data: ArrayBuffer,
) {
  const parsed = await parseImportSource(sourceType, data);
  if (parsed.errors.length) return { errors: parsed.errors } as const;

  let summary: unknown;
  let staffRows: unknown;
  let staffTransportRows: unknown;
  let availableMembers: unknown;
  let agencyRows: unknown;
  let changes: unknown;
  if (parsed.sourceType === "validated_roster") {
    const preview = await previewValidatedRoster(database, tripId, parsed.rows);
    const { changes: rosterChanges, ...counts } = preview;
    summary = counts;
    changes = rosterChanges;
  } else if (parsed.sourceType === "detailed_orders") {
    const preview = await previewDetailedOrders(database, tripId, parsed.rows);
    const { changes: detailChanges, ...counts } = preview;
    summary = counts;
    changes = detailChanges;
  } else if (parsed.sourceType === "companions_vips") {
    const preview = await previewStaffImport(database, tripId, parsed.rows);
    staffRows = preview.rows;
    availableMembers = preview.availableMembers;
    staffTransportRows = preview.transportRows;
    summary = { rows: preview.rows.length, ...preview.transportSummary };
  } else {
    const preview = await previewAgencyRooming(database, tripId, parsed.rows);
    const { rows: matchedRows, ...counts } = preview;
    summary = counts;
    agencyRows = matchedRows;
  }

  const now = new Date();
  await database
    .delete(schema.tripImportPreviews)
    .where(lte(schema.tripImportPreviews.expiresAt, now));
  const previewId = randomUUID();
  const baseSnapshotHash = await getImportBaselineHash(database, tripId);
  await database.insert(schema.tripImportPreviews).values({
    id: previewId,
    tripId,
    actorUserId,
    sourceType,
    contentHash: createHash("sha256")
      .update(new Uint8Array(data))
      .digest("hex"),
    baseSnapshotHash,
    expiresAt: new Date(now.getTime() + 15 * 60_000),
    createdAt: now,
  });
  return {
    previewId,
    sourceType,
    summary,
    staffRows,
    staffTransportRows,
    availableMembers,
    agencyRows,
    changes,
  } as const;
}
