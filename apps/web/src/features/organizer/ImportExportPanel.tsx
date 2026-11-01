import type { FormEvent } from "react";
import {
  Form,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TabPanel,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  buttonStyles,
  Card,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import { FileDropZone } from "../../components/ui/FileDropZone";
import { AgencySpreadsheetForm } from "./AgencySpreadsheetForm";
import { ImportPreviewCard } from "./ImportPreviewCard";
import type { ImportPreview, ImportSourceType } from "./import-types";

type ImportExportPanelProps = {
  tripId: string;
  importSourceType: ImportSourceType;
  setImportSourceType: (source: ImportSourceType) => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  importPreview: ImportPreview | null;
  setImportPreview: (preview: ImportPreview | null) => void;
  managerEmails: string[];
  toggleManagerEmail: (email: string) => void;
  accountMappings: Record<string, string>;
  setAccountMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
  previewParticipantImport: (event: FormEvent<HTMLFormElement>) => void;
  commitParticipantImport: () => void;
  agencyTemplateFile: File | null;
  setAgencyTemplateFile: (file: File | null) => void;
  prepareAgencySpreadsheet: (event: FormEvent<HTMLFormElement>) => void;
  isPreviewing: boolean;
  isCommitting: boolean;
  isPreparingAgencySpreadsheet: boolean;
};

export function ImportExportPanel(props: ImportExportPanelProps) {
  const { t } = useTranslation();
  const {
    tripId,
    importSourceType,
    setImportSourceType,
    importFile,
    setImportFile,
    importPreview,
    setImportPreview,
    managerEmails,
    toggleManagerEmail,
    accountMappings,
    setAccountMappings,
    previewParticipantImport,
    commitParticipantImport,
    agencyTemplateFile,
    setAgencyTemplateFile,
    prepareAgencySpreadsheet,
    isPreviewing,
    isCommitting,
    isPreparingAgencySpreadsheet,
  } = props;
  return (
    <TabPanel id="imports" className="grid gap-5 outline-none">
      <Card
        as={Form}
        spacing="compact"
        arrangement="form"
        onSubmit={previewParticipantImport}
      >
        <h4 className="col-span-full text-base font-bold">
          {t("tripImports")}
        </h4>
        <p className="col-span-full text-sm leading-relaxed text-content-muted">
          {t(
            "reviewTheSpreadsheetAndItsChangesBeforeConfirmingTheImportEachSourceTypeFollowsItsOwnRules",
          )}
        </p>
        <p className="col-span-full rounded-control bg-surface-muted px-3 py-2 text-sm leading-relaxed text-content-muted">
          {t("detailedImportDescription")}
        </p>
        <Select
          className="col-span-full grid gap-2"
          selectedKey={importSourceType}
          onSelectionChange={(key) => {
            if (key) {
              setImportSourceType(key as ImportSourceType);
              setImportPreview(null);
            }
          }}
        >
          <Label className={textFieldStyles().label()}>
            {t("spreadsheetType")}
          </Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem
                className={listBoxStyles().item()}
                id="validated_roster"
              >
                {t("confirmedParticipantList")}
              </ListBoxItem>
              <ListBoxItem
                className={listBoxStyles().item()}
                id="detailed_orders"
              >
                {t("detailedOrderList")}
              </ListBoxItem>
              <ListBoxItem
                className={listBoxStyles().item()}
                id="companions_vips"
              >
                {t("companionsAndVips")}
              </ListBoxItem>
              <ListBoxItem
                className={listBoxStyles().item()}
                id="agency_rooming"
              >
                {t("roomingListReturnedByTheAgency")}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <div className="col-span-full">
          <FileDropZone
            file={importFile}
            label={t("dropSpreadsheetOrBrowse")}
            description={t("excelSpreadsheetXlsx")}
            acceptedFileTypes={[
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ]}
            extensions={[".xlsx"]}
            onFileChange={(file) => {
              setImportFile(file);
              setImportPreview(null);
            }}
          />
        </div>
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={!importFile || isPreviewing}
        >
          {t("reviewSpreadsheet")}
        </Button>
        <ImportPreviewCard
          importPreview={importPreview}
          managerEmails={managerEmails}
          toggleManagerEmail={toggleManagerEmail}
          accountMappings={accountMappings}
          setAccountMappings={setAccountMappings}
          onCommit={commitParticipantImport}
          isCommitting={isCommitting}
        />
      </Card>
      <a
        className={buttonStyles({ appearance: "secondary" })}
        href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
      >
        {t("exportTheRoomingSummary")}
      </a>
      <AgencySpreadsheetForm
        file={agencyTemplateFile}
        onFileChange={setAgencyTemplateFile}
        onSubmit={prepareAgencySpreadsheet}
        isPreparing={isPreparingAgencySpreadsheet}
      />
    </TabPanel>
  );
}
