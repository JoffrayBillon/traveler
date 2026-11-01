import type { FormEvent } from "react";
import { Form } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Button, Card } from "../../components/ui";
import { FileDropZone } from "../../components/ui/FileDropZone";

export function AgencySpreadsheetForm({
  file,
  onFileChange,
  onSubmit,
  isPreparing,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPreparing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card as={Form} spacing="compact" arrangement="stack" onSubmit={onSubmit}>
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
        onFileChange={onFileChange}
      />
      <Button
        appearance="secondary"
        type="submit"
        isDisabled={!file || isPreparing}
      >
        {t("downloadTheCompletedAgencySpreadsheet")}
      </Button>
    </Card>
  );
}
