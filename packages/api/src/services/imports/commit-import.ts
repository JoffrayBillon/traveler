import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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

  const currentBaselineHash = await getImportBaselineHash(database, tripId);
  if (currentBaselineHash !== preview.baseSnapshotHash)
    throw new ImportCommitConflict("import_preview_stale");

  const contentHash = createHash("sha256")
    .update(new Uint8Array(data))
    .digest("hex");
  if (contentHash !== preview.contentHash)
    throw new ImportCommitConflict("import_file_changed");

  const parsed = await parseImportSource(sourceType, data);
  if (parsed.errors.length) return { errors: parsed.errors } as const;

  let result: unknown;
  if (parsed.sourceType === "validated_roster") {
    result = await importValidatedRoster(database, tripId, parsed.rows);
  } else if (parsed.sourceType === "detailed_orders") {
    result = await importDetailedOrders(database, tripId, parsed.rows);
  } else if (parsed.sourceType === "companions_vips") {
    result = await importStaffRows(
      database,
      tripId,
      parsed.rows,
      staffOptions.managerEmails,
      staffOptions.accountMappings,
    );
  } else {
    result = await importAgencyRooming(database, tripId, parsed.rows);
  }

  await database
    .delete(schema.tripImportPreviews)
    .where(eq(schema.tripImportPreviews.id, preview.id));
  return { result } as const;
}

export { DuplicateNormalizedEmailError };
