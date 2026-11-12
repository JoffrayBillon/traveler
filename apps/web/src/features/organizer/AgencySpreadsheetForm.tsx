import { ApiError } from "@traveler/api/client";
import { useAgencySpreadsheetMutation } from "@traveler/api/imports/mutations";
import { Button, Card } from "@traveler/components/ui";
import { FileDropZone } from "@traveler/components/ui/FileDropZone";
import type { FormEvent } from "react";
import { useState } from "react";
import { Form } from "react-aria-components";
import { useTranslation } from "react-i18next";

export function AgencySpreadsheetForm({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const spreadsheetMutation = useAgencySpreadsheetMutation(tripId);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function prepareSpreadsheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await spreadsheetMutation.mutateAsync(form);
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
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setMessage(
        t(
          code === "agency_room_plan_missing"
            ? "agencySpreadsheetRoomPlanMissing"
            : code === "agency_room_inventory_mismatch" ||
                code === "agency_room_capacity_mismatch"
              ? "agencySpreadsheetRoomCapacityMismatch"
              : "agencySpreadsheetCouldNotBePrepared",
        ),
      );
    }
  }

  return (
    <Card
      as={Form}
      spacing="compact"
      arrangement="stack"
      onSubmit={prepareSpreadsheet}
    >
      <h4 className="text-base font-bold">
        {t("prepareTheAgencySpreadsheet")}
      </h4>
      <p className="text-sm text-content-muted">
        {t(
          "uploadThe2025MatriceRoominglisteSkiOnePointXlsxTemplateToFillItWithRoomsTravelersDietaryRequirementsAndTransportInformationKeepTheTrainSeatColumnsFromTheTemplate",
        )}
      </p>
      <FileDropZone
        file={file}
        label={t("dropSpreadsheetOrBrowse")}
        description={t("excelSpreadsheetXlsx")}
        acceptedFileTypes={[
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ]}
        extensions={[".xlsx"]}
        onFileChange={setFile}
      />
      <Button
        appearance="secondary"
        type="submit"
        isDisabled={!file || spreadsheetMutation.isPending}
      >
        {t("downloadTheCompletedAgencySpreadsheet")}
      </Button>
      {message && (
        <p className="text-sm text-content-muted" role="status">
          {message}
        </p>
      )}
    </Card>
  );
}
