import type { Hono } from "hono";
import type { AuthServices } from "../auth";
import { getTripMembershipRole } from "../datamodel/trip-membership.repository";
import { getSession } from "../services/auth/get-session";
import {
  commitImportSource,
  DuplicateNormalizedEmailError,
  ImportCommitConflict,
  InvalidStaffImportRowSelectionError,
} from "../services/imports/commit-import";
import { isImportSourceType } from "../services/imports/import-source";
import {
  InvalidAgencyRoomingMatchError,
  InvalidStaffAccountMappingError,
  InvalidStaffTransportMappingError,
} from "../source-imports";

export function registerImportCommitEndpoint(
  app: Hono,
  getAuthServices: () => AuthServices | undefined,
) {
  app.post("/api/trips/:tripId/imports/commit", async (context) => {
    context.header("Cache-Control", "no-store");
    const services = getAuthServices();
    if (!services) return context.json({ error: "service_unavailable" }, 503);
    const session = await getSession(services, context.req.raw.headers);
    if (!session) return context.json({ error: "unauthorized" }, 401);

    const tripId = context.req.param("tripId");
    const membership = await getTripMembershipRole(
      services.database,
      tripId,
      session.user.id,
    );
    if (!membership) return context.json({ error: "not_found" }, 404);
    if (membership.role !== "manager")
      return context.json({ error: "forbidden" }, 403);

    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "invalid_import_file" }, 400);
    }
    const file = form.get("file");
    const sourceType = form.get("sourceType");
    const previewId = form.get("previewId");
    if (!isImportSourceType(sourceType) || typeof previewId !== "string")
      return context.json({ error: "invalid_import_confirmation" }, 400);
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx"))
      return context.json({ error: "xlsx_file_required" }, 400);
    if (file.size < 1 || file.size > 4 * 1024 * 1024)
      return context.json({ error: "import_file_size_not_allowed" }, 413);

    const staffOptions = parseStaffOptions(form);
    if (!staffOptions.ok)
      return context.json({ error: staffOptions.error }, 400);

    try {
      const commit = await commitImportSource(
        services.database,
        tripId,
        session.user.id,
        sourceType,
        previewId,
        await file.arrayBuffer(),
        staffOptions.value,
      );
      if ("errors" in commit) return context.json(commit, 422);
      return context.json({ status: "imported", result: commit.result });
    } catch (error) {
      if (error instanceof ImportCommitConflict)
        return context.json({ error: error.code }, 409);
      if (error instanceof InvalidStaffImportRowSelectionError)
        return context.json({ error: error.message }, 400);
      if (error instanceof InvalidStaffAccountMappingError)
        return context.json({ error: "invalid_account_mappings" }, 422);
      if (error instanceof InvalidStaffTransportMappingError)
        return context.json({ error: "invalid_transport_mappings" }, 422);
      if (error instanceof InvalidAgencyRoomingMatchError)
        return context.json({ error: "agency_rooming_name_match_failed" }, 422);
      if (error instanceof DuplicateNormalizedEmailError)
        return context.json({ error: "duplicate_email_accounts" }, 409);
      return context.json({ error: "participant_import_failed" }, 503);
    }
  });
}

function parseStaffOptions(form: FormData) {
  let managerEmails: string[] = [];
  let accountMappings: Record<string, string> = {};
  let transportMappings: Record<string, string> = {};
  let excludedRows: number[] = [];
  const managerEmailsValue = form.get("managerEmails");
  const accountMappingsValue = form.get("accountMappings");

  if (typeof managerEmailsValue === "string") {
    try {
      const parsed: unknown = JSON.parse(managerEmailsValue);
      if (
        !Array.isArray(parsed) ||
        parsed.some((email) => typeof email !== "string")
      )
        return { ok: false as const, error: "invalid_manager_assignments" };
      managerEmails = parsed;
    } catch {
      return { ok: false as const, error: "invalid_manager_assignments" };
    }
  }

  if (typeof accountMappingsValue === "string") {
    try {
      const parsed: unknown = JSON.parse(accountMappingsValue);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        Object.values(parsed).some((userId) => typeof userId !== "string")
      )
        return { ok: false as const, error: "invalid_account_mappings" };
      accountMappings = parsed as Record<string, string>;
    } catch {
      return { ok: false as const, error: "invalid_account_mappings" };
    }
  }

  const transportMappingsValue = form.get("transportMappings");
  if (typeof transportMappingsValue === "string") {
    try {
      const parsed: unknown = JSON.parse(transportMappingsValue);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        Object.values(parsed).some((groupId) => typeof groupId !== "string")
      )
        return { ok: false as const, error: "invalid_transport_mappings" };
      transportMappings = parsed as Record<string, string>;
    } catch {
      return { ok: false as const, error: "invalid_transport_mappings" };
    }
  }

  const excludedRowsValue = form.get("excludedRows");
  if (typeof excludedRowsValue === "string") {
    try {
      const parsed: unknown = JSON.parse(excludedRowsValue);
      if (
        !Array.isArray(parsed) ||
        parsed.some((row) => !Number.isSafeInteger(row) || row < 1) ||
        new Set(parsed).size !== parsed.length
      )
        return { ok: false as const, error: "invalid_import_row_selection" };
      excludedRows = parsed as number[];
    } catch {
      return { ok: false as const, error: "invalid_import_row_selection" };
    }
  }

  return {
    ok: true as const,
    value: { managerEmails, accountMappings, transportMappings, excludedRows },
  };
}
