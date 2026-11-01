import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../shared/api/client";
import { formatImportError } from "./import-formatters";
import {
  useAgencySpreadsheetMutation,
  useCommitParticipantImportMutation,
  usePreviewParticipantImportMutation,
  useUpdateTripNameMutation,
} from "./import-mutations";
import type {
  ImportPreview,
  ImportPreviewResponse,
  ImportSourceType,
} from "./import-types";

export function useOrganizerWorkflow(tripId: string, tripName: string) {
  const { t } = useTranslation();
  const previewImportMutation = usePreviewParticipantImportMutation(tripId);
  const commitImportMutation = useCommitParticipantImportMutation(tripId);
  const updateTripNameMutation = useUpdateTripNameMutation(tripId);
  const agencySpreadsheetMutation = useAgencySpreadsheetMutation(tripId);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [agencyTemplateFile, setAgencyTemplateFile] = useState<File | null>(
    null,
  );
  const [importSourceType, setImportSourceType] =
    useState<ImportSourceType>("validated_roster");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [managerEmails, setManagerEmails] = useState<string[]>([]);
  const [accountMappings, setAccountMappings] = useState<
    Record<string, string>
  >({});
  const [editableTripName, setEditableTripName] = useState(tripName);
  const [message, setMessage] = useState("");

  useEffect(() => setEditableTripName(tripName), [tripName]);

  async function previewParticipantImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      setMessage(t("chooseAnExcelSpreadsheetToImport"));
      return;
    }
    if (importFile.size > 4 * 1024 * 1024) {
      setMessage(t("theExcelSpreadsheetMustBeNoLargerThan4Mb"));
      return;
    }

    const form = new FormData();
    form.set("file", importFile);
    form.set("sourceType", importSourceType);
    try {
      const result = await previewImportMutation.mutateAsync(form);
      if (!result.previewId || !result.sourceType || !result.summary) {
        setMessage(t("theImportSummaryCouldNotBeLoaded"));
        return;
      }
      setImportPreview({
        previewId: result.previewId,
        sourceType: result.sourceType,
        summary: result.summary,
        ...(result.staffRows ? { staffRows: result.staffRows } : {}),
        ...(result.availableMembers
          ? { availableMembers: result.availableMembers }
          : {}),
        ...(result.agencyRows ? { agencyRows: result.agencyRows } : {}),
        ...(result.changes ? { changes: result.changes } : {}),
      });
      setManagerEmails([]);
      setAccountMappings({});
      setMessage(t("reviewTheSummaryBeforeConfirmingTheImport"));
    } catch (error) {
      const payload = error instanceof ApiError ? error.payload : null;
      const result =
        payload && typeof payload === "object"
          ? (payload as ImportPreviewResponse)
          : {};
      setMessage(
        result.errors?.map((item) => formatImportError(item, t)).join("\n") ??
          t("theFileImportFailed"),
      );
    }
  }

  async function commitParticipantImport() {
    if (!importFile || !importPreview) return;
    const form = new FormData();
    form.set("file", importFile);
    form.set("sourceType", importPreview.sourceType);
    form.set("previewId", importPreview.previewId);
    if (importPreview.sourceType === "companions_vips") {
      form.set("managerEmails", JSON.stringify(managerEmails));
      form.set("accountMappings", JSON.stringify(accountMappings));
    }

    try {
      await commitImportMutation.mutateAsync(form);
    } catch (error) {
      const payload = error instanceof ApiError ? error.payload : null;
      const result = (
        payload && typeof payload === "object" ? payload : {}
      ) as { errors?: { row: number; field: string; message: string }[] };
      setImportPreview(null);
      setMessage(
        result.errors?.map((item) => formatImportError(item, t)).join("\n") ??
          t("theImportFailedReviewTheSpreadsheetAgain"),
      );
      return;
    }

    setMessage(
      t("importCompleteInformationAddedByTheOrganizersHasBeenPreserved"),
    );
    setImportFile(null);
    setImportPreview(null);
    setManagerEmails([]);
    setAccountMappings({});
  }

  function toggleManagerEmail(email: string) {
    setManagerEmails((current) =>
      current.includes(email)
        ? current.filter((item) => item !== email)
        : [...current, email],
    );
  }

  async function saveTripName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = editableTripName.trim();
    try {
      await updateTripNameMutation.mutateAsync(nextName);
    } catch {
      setMessage(t("theTripNameCouldNotBeUpdated"));
      return;
    }
    setMessage(t("theTripNameHasBeenUpdated"));
  }

  async function prepareAgencySpreadsheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agencyTemplateFile) return;
    const form = new FormData();
    form.set("file", agencyTemplateFile);
    try {
      const response = await agencySpreadsheetMutation.mutateAsync(form);
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ??
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        "rooming-agency.xlsx";
      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = decodeURIComponent(filename);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setMessage(t("agencySpreadsheetIsReady"));
    } catch {
      setMessage(t("agencySpreadsheetCouldNotBePrepared"));
    }
  }

  return {
    importFile,
    setImportFile,
    agencyTemplateFile,
    setAgencyTemplateFile,
    importSourceType,
    setImportSourceType,
    importPreview,
    setImportPreview,
    managerEmails,
    accountMappings,
    setAccountMappings,
    editableTripName,
    setEditableTripName,
    message,
    toggleManagerEmail,
    previewParticipantImport,
    commitParticipantImport,
    saveTripName,
    prepareAgencySpreadsheet,
    isPreviewing: previewImportMutation.isPending,
    isCommitting: commitImportMutation.isPending,
    isUpdatingTripName: updateTripNameMutation.isPending,
    isPreparingAgencySpreadsheet: agencySpreadsheetMutation.isPending,
  };
}
