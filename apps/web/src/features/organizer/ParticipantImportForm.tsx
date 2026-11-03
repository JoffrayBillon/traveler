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

export function ParticipantImportForm({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const previewMutation = usePreviewParticipantImportMutation(tripId);
  const commitMutation = useCommitParticipantImportMutation(tripId);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] =
    useState<ImportSourceType>("validated_roster");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [managerEmails, setManagerEmails] = useState<string[]>([]);
  const [accountMappings, setAccountMappings] = useState<
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
        ...(result.agencyRows ? { agencyRows: result.agencyRows } : {}),
        ...(result.changes ? { changes: result.changes } : {}),
      });
      setManagerEmails([]);
      setAccountMappings({});
      setMessage(t("reviewTheSummaryBeforeConfirmingTheImport"));
    } catch (error) {
      const result = getImportErrorPayload(error);
      setMessage(
        result.errors?.map((item) => formatImportError(item, t)).join("\n") ??
          t("theFileImportFailed"),
      );
    }
  }

  async function commitImport() {
    if (!file || !preview) return;
    const form = new FormData();
    form.set("file", file);
    form.set("sourceType", preview.sourceType);
    form.set("previewId", preview.previewId);
    if (preview.sourceType === "companions_vips") {
      form.set("managerEmails", JSON.stringify(managerEmails));
      form.set("accountMappings", JSON.stringify(accountMappings));
    }

    try {
      await commitMutation.mutateAsync(form);
    } catch (error) {
      const result = getImportErrorPayload(error);
      setPreview(null);
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
      <ImportPreviewCard
        importPreview={preview}
        managerEmails={managerEmails}
        toggleManagerEmail={toggleManagerEmail}
        accountMappings={accountMappings}
        setAccountMappings={setAccountMappings}
        onCommit={() => void commitImport()}
        isCommitting={commitMutation.isPending}
      />
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
