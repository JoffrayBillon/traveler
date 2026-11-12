import { getImportErrorPayload } from "@traveler/api/imports/errors";
import { formatImportError } from "@traveler/api/imports/formatters";
import type {
  ImportPreview,
  ImportSourceType,
} from "@traveler/api/imports/import.types";
import {
  useCommitParticipantImportMutation,
  usePreviewParticipantImportMutation,
} from "@traveler/api/imports/mutations";
import { Button, Card } from "@traveler/components/ui";
import { FileDropZone } from "@traveler/components/ui/FileDropZone";
import { ImportSourcePicker } from "@traveler/features/organizer/ImportSourcePicker";
import { type FormEvent, useState } from "react";
import { Form } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { ImportPreviewCard } from "./ImportPreviewCard";
import { ImportPreviewDialog } from "./ImportPreviewDialog";

export function ParticipantImportForm({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const previewMutation = usePreviewParticipantImportMutation(tripId);
  const commitMutation = useCommitParticipantImportMutation(tripId);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] =
    useState<ImportSourceType>("validated_roster");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [excludedRows, setExcludedRows] = useState<number[]>([]);
  const [managerEmails, setManagerEmails] = useState<string[]>([]);
  const [accountMappings, setAccountMappings] = useState<
    Record<string, string>
  >({});
  const [transportMappings, setTransportMappings] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState("");

  async function previewImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage(t("chooseAnExcelSpreadsheetToImport"));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMessage(t("theExcelSpreadsheetMustBeNoLargerThan4Mb"));
      return;
    }

    const form = new FormData();
    setValidationErrors([]);
    setPreview(null);
    setMessage("");
    form.set("file", file);
    form.set("sourceType", sourceType);
    try {
      const result = await previewMutation.mutateAsync(form);
      if (!result.previewId || !result.sourceType || !result.summary) {
        setMessage(t("theImportSummaryCouldNotBeLoaded"));
        return;
      }
      setPreview({
        previewId: result.previewId,
        sourceType: result.sourceType,
        summary: result.summary,
        ...(result.staffRows ? { staffRows: result.staffRows } : {}),
        ...(result.availableMembers
          ? { availableMembers: result.availableMembers }
          : {}),
        ...(result.staffTransportRows
          ? { staffTransportRows: result.staffTransportRows }
          : {}),
        ...(result.agencyRows ? { agencyRows: result.agencyRows } : {}),
        ...(result.changes ? { changes: result.changes } : {}),
      });
      setIsPreviewOpen(true);
      setManagerEmails(
        (result.staffRows ?? [])
          .filter((row) => row.existingRole === "manager")
          .map((row) => row.email.trim().toLowerCase()),
      );
      setExcludedRows([]);
      const userIdByEmail = new Map(
        (result.availableMembers ?? []).map((member) => [
          member.email.trim().toLowerCase(),
          member.userId,
        ]),
      );
      setAccountMappings(
        Object.fromEntries(
          (result.staffRows ?? []).flatMap((row) => {
            const userId = userIdByEmail.get(row.email.trim().toLowerCase());
            return userId ? [[row.email.trim().toLowerCase(), userId]] : [];
          }),
        ),
      );
      setTransportMappings({});
      setMessage(t("reviewTheSummaryBeforeConfirmingTheImport"));
    } catch (error) {
      const result = getImportErrorPayload(error);
      if (result.errors?.length) {
        setValidationErrors([
          ...new Set(result.errors.map((item) => formatImportError(item, t))),
        ]);
        setIsPreviewOpen(true);
      } else {
        setMessage(t("theFileImportFailed"));
      }
    }
  }

  async function commitImport() {
    if (!file || !preview) return;
    const form = new FormData();
    form.set("file", file);
    form.set("sourceType", preview.sourceType);
    form.set("previewId", preview.previewId);
    if (
      preview.sourceType === "detailed_orders" ||
      preview.sourceType === "companions_vips"
    ) {
      form.set("transportMappings", JSON.stringify(transportMappings));
    }
    if (preview.sourceType === "companions_vips") {
      form.set("managerEmails", JSON.stringify(managerEmails));
      form.set("accountMappings", JSON.stringify(accountMappings));
      form.set("excludedRows", JSON.stringify(excludedRows));
    }

    try {
      await commitMutation.mutateAsync(form);
    } catch (error) {
      const result = getImportErrorPayload(error);
      setPreview(null);
      setIsPreviewOpen(false);
      setMessage(
        result.errors?.map((item) => formatImportError(item, t)).join("\n") ??
          t("theImportFailedReviewTheSpreadsheetAgain"),
      );
      return;
    }

    setMessage(
      t("importCompleteInformationAddedByTheOrganizersHasBeenPreserved"),
    );
    setFile(null);
    setPreview(null);
    setIsPreviewOpen(false);
    setManagerEmails([]);
    setExcludedRows([]);
    setAccountMappings({});
    setTransportMappings({});
  }

  function toggleManagerEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    setManagerEmails((current) =>
      current.includes(normalizedEmail)
        ? current.filter((item) => item !== normalizedEmail)
        : [...current, normalizedEmail],
    );
  }

  return (
    <Card
      spacing="compact"
      arrangement="form"
      as={Form}
      onSubmit={previewImport}
    >
      <h4 className="col-span-full text-base font-bold">{t("tripImports")}</h4>
      <p className="col-span-full text-sm leading-relaxed text-content-muted">
        {t(
          "reviewTheSpreadsheetAndItsChangesBeforeConfirmingTheImportEachSourceTypeFollowsItsOwnRules",
        )}
      </p>
      <p className="col-span-full rounded-control bg-surface-muted px-3 py-2 text-sm leading-relaxed text-content-muted">
        {t("detailedImportDescription")}
      </p>
      <ImportSourcePicker
        value={sourceType}
        onChange={(value) => {
          setSourceType(value);
          setPreview(null);
          setValidationErrors([]);
          setIsPreviewOpen(false);
        }}
      />
      <div className="col-span-full">
        <FileDropZone
          file={file}
          label={t("dropSpreadsheetOrBrowse")}
          description={t("excelSpreadsheetXlsx")}
          acceptedFileTypes={[
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ]}
          extensions={[".xlsx"]}
          onFileChange={(nextFile) => {
            setFile(nextFile);
            setPreview(null);
            setValidationErrors([]);
            setIsPreviewOpen(false);
          }}
        />
      </div>
      <Button
        appearance="secondary"
        type="submit"
        isDisabled={!file || previewMutation.isPending}
      >
        {t("reviewSpreadsheet")}
      </Button>
      {(preview || validationErrors.length > 0) && (
        <Button
          appearance="secondary"
          type="button"
          onPress={() => setIsPreviewOpen(true)}
        >
          {t("openImportPreview")}
        </Button>
      )}
      <ImportPreviewDialog
        isOpen={
          isPreviewOpen && (preview !== null || validationErrors.length > 0)
        }
        onOpenChange={setIsPreviewOpen}
      >
        {validationErrors.length > 0 && (
          <section className="grid gap-3">
            <h3 className="font-bold">{t("importValidationReport")}</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </section>
        )}
        <ImportPreviewCard
          importPreview={preview}
          excludedRows={excludedRows}
          setExcludedRows={setExcludedRows}
          managerEmails={managerEmails}
          toggleManagerEmail={toggleManagerEmail}
          accountMappings={accountMappings}
          setAccountMappings={setAccountMappings}
          transportMappings={transportMappings}
          setTransportMappings={setTransportMappings}
          onCommit={() => void commitImport()}
          isCommitting={commitMutation.isPending}
        />
      </ImportPreviewDialog>
      {message && (
        <p
          className="col-span-full text-sm text-content-muted"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </Card>
  );
}
