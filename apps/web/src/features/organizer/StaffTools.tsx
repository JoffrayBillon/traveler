import { useReducedMotion } from "motion/react";
import { lazy, Suspense } from "react";
import {
  Form,
  Input,
  Label,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  messageStyles,
  textFieldStyles,
} from "../../components/ui";
import { ImportExportPanel } from "./ImportExportPanel";
import { TabSelectionIndicator } from "./TabSelectionIndicator";
import { TravelerTicketUpload } from "./TravelerTicketUpload";
import { useOrganizerWorkflow } from "./useOrganizerWorkflow";

const ParticipantDirectory = lazy(() =>
  import("./ParticipantDirectory").then((module) => ({
    default: module.ParticipantDirectory,
  })),
);

export function StaffTools({
  tripId,
  tripName,
  isManager,
}: {
  tripId: string;
  tripName: string;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const workflow = useOrganizerWorkflow(tripId, tripName);
  const {
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
    isPreviewing,
    isCommitting,
    isPreparingAgencySpreadsheet,
  } = workflow;
  return (
    <section className="grid gap-5" aria-labelledby="staff-tools-title">
      <div className="grid gap-1">
        <div>
          <h3 className="text-lg font-bold" id="staff-tools-title">
            {t("organizerTools")}
          </h3>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("transportRoomingAndParticipantInformation")}
          </p>
        </div>
      </div>
      <Tabs className="grid gap-5" defaultSelectedKey="participants">
        <TabList
          className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-control border border-border bg-surface-muted p-1"
          aria-label={t("organizerSections")}
        >
          <Tab
            id="participants"
            className="relative isolate cursor-pointer rounded-control px-4 py-2 text-sm font-semibold text-content-muted outline-none transition-colors data-[selected]:text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
          >
            {({ isSelected }) => (
              <>
                {isSelected && (
                  <TabSelectionIndicator
                    reduceMotion={Boolean(shouldReduceMotion)}
                  />
                )}
                <span className="relative z-10 whitespace-nowrap">
                  {t("participantsAndUsers")}
                </span>
              </>
            )}
          </Tab>
          {isManager && (
            <Tab
              id="imports"
              className="relative isolate cursor-pointer rounded-control px-4 py-2 text-sm font-semibold text-content-muted outline-none transition-colors data-[selected]:text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
            >
              {({ isSelected }) => (
                <>
                  {isSelected && (
                    <TabSelectionIndicator
                      reduceMotion={Boolean(shouldReduceMotion)}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">
                    {t("importsAndExports")}
                  </span>
                </>
              )}
            </Tab>
          )}
          {isManager && (
            <Tab
              id="trip"
              className="relative isolate cursor-pointer rounded-control px-4 py-2 text-sm font-semibold text-content-muted outline-none transition-colors data-[selected]:text-content data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
            >
              {({ isSelected }) => (
                <>
                  {isSelected && (
                    <TabSelectionIndicator
                      reduceMotion={Boolean(shouldReduceMotion)}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">
                    {t("tripAndOptions")}
                  </span>
                </>
              )}
            </Tab>
          )}
        </TabList>
        <TabPanel id="participants" className="grid gap-5 outline-none">
          <Suspense fallback={<p role="status">{t("loadingParticipants")}</p>}>
            <ParticipantDirectory tripId={tripId} isManager={isManager} />
          </Suspense>
          <TravelerTicketUpload tripId={tripId} />
        </TabPanel>
        {isManager && (
          <ImportExportPanel
            tripId={tripId}
            importSourceType={importSourceType}
            setImportSourceType={setImportSourceType}
            importFile={importFile}
            setImportFile={setImportFile}
            importPreview={importPreview}
            setImportPreview={setImportPreview}
            managerEmails={managerEmails}
            toggleManagerEmail={toggleManagerEmail}
            accountMappings={accountMappings}
            setAccountMappings={setAccountMappings}
            previewParticipantImport={previewParticipantImport}
            commitParticipantImport={() => void commitParticipantImport()}
            agencyTemplateFile={agencyTemplateFile}
            setAgencyTemplateFile={setAgencyTemplateFile}
            prepareAgencySpreadsheet={prepareAgencySpreadsheet}
            isPreviewing={isPreviewing}
            isCommitting={isCommitting}
            isPreparingAgencySpreadsheet={isPreparingAgencySpreadsheet}
          />
        )}
        {isManager && (
          <TabPanel id="trip" className="grid gap-5 outline-none">
            <section
              className="grid gap-2"
              aria-labelledby="trip-settings-title"
            >
              <h4 className="text-base font-bold" id="trip-settings-title">
                {t("tripInformation")}
              </h4>
              <p className="text-sm leading-relaxed text-content-muted">
                {t("manageTripAndOptionsDescription")}
              </p>
            </section>
            <Card
              as={Form}
              spacing="compact"
              arrangement="form"
              onSubmit={saveTripName}
            >
              <TextField
                className="grid min-w-0 gap-2"
                value={editableTripName}
                onChange={setEditableTripName}
                isRequired
              >
                <Label className={textFieldStyles().label()}>
                  {t("tripName")}
                </Label>
                <Input className={textFieldStyles().input()} maxLength={120} />
              </TextField>
              <Button appearance="secondary" type="submit">
                {t("save")}
              </Button>
            </Card>
          </TabPanel>
        )}
      </Tabs>
      {message && (
        <p
          className={`${messageStyles()} whitespace-pre-line`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}
