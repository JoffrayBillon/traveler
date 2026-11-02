import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { AppDatabase } from "../../auth";
import * as schema from "../../schema";
import {
  DuplicateNormalizedEmailError,
  getImportBaselineHash,
  importAgencyRooming,
  importDetailedOrders,
  importStaffRows,
  importValidatedRoster,
} from "../../source-imports";
import type { ImportSourceType } from "./import-source";
import { parseImportSource } from "./import-source";

export class ImportCommitConflict extends Error {
  constructor(
    readonly code:
      | "import_preview_expired"
      | "import_preview_stale"
      | "import_file_changed",
  ) {
    super(code);
    this.name = "ImportCommitConflict";
  }
}

export async function commitImportSource(
  database: AppDatabase,
  tripId: string,
  actorUserId: string,
  sourceType: ImportSourceType,
  previewId: string,
  data: ArrayBuffer,
  staffOptions: {
    managerEmails: string[];
    accountMappings: Record<string, string>;
  },
) {
  const [preview] = await database
    .select()
    .from(schema.tripImportPreviews)
    .where(
      and(
        eq(schema.tripImportPreviews.id, previewId),
        eq(schema.tripImportPreviews.tripId, tripId),
        eq(schema.tripImportPreviews.actorUserId, actorUserId),
        eq(schema.tripImportPreviews.sourceType, sourceType),
        sql`${schema.tripImportPreviews.expiresAt} > ${new Date()}`,
      ),
    )
    .limit(1);
  if (!preview) throw new ImportCommitConflict("import_preview_expired");

  const contentHash = createHash("sha256")
    .update(new Uint8Array(data))
    .digest("hex");
  if (contentHash !== preview.contentHash)
    throw new ImportCommitConflict("import_file_changed");

  const parsed = await parseImportSource(sourceType, data);
  if (parsed.errors.length) return { errors: parsed.errors } as const;

  // Claim the preview, validate the baseline and apply imported rows together.
  // A concurrent commit then observes either the old state or the complete new one.
  const result = await database.transaction(async (transaction) => {
    const [claimedPreview] = await transaction
      .delete(schema.tripImportPreviews)
      .where(
        and(
          eq(schema.tripImportPreviews.id, preview.id),
          eq(schema.tripImportPreviews.tripId, tripId),
          eq(schema.tripImportPreviews.actorUserId, actorUserId),
          eq(schema.tripImportPreviews.sourceType, sourceType),
          eq(schema.tripImportPreviews.contentHash, contentHash),
          gt(schema.tripImportPreviews.expiresAt, new Date()),
        ),
      )
      .returning({ id: schema.tripImportPreviews.id });
    if (!claimedPreview)
      throw new ImportCommitConflict("import_preview_expired");

    const currentBaselineHash = await getImportBaselineHash(
      transaction,
      tripId,
    );
    if (currentBaselineHash !== preview.baseSnapshotHash)
      throw new ImportCommitConflict("import_preview_stale");

    if (parsed.sourceType === "validated_roster")
      return importValidatedRoster(database, tripId, parsed.rows, transaction);
    if (parsed.sourceType === "detailed_orders")
      return importDetailedOrders(database, tripId, parsed.rows, transaction);
    if (parsed.sourceType === "companions_vips")
      return importStaffRows(
        database,
        tripId,
        parsed.rows,
        staffOptions.managerEmails,
        staffOptions.accountMappings,
        transaction,
      );
    return importAgencyRooming(database, tripId, parsed.rows, transaction);
  });

  return { result } as const;
}

export { DuplicateNormalizedEmailError };
