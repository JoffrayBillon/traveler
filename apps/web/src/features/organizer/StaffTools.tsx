import { useReducedMotion } from "motion/react";
import { lazy, Suspense } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { ImportExportPanel } from "./ImportExportPanel";
import { TabSelectionIndicator } from "./TabSelectionIndicator";
import { TravelerTicketUpload } from "./TravelerTicketUpload";
import { TripSettingsPanel } from "./TripSettingsPanel";

const ParticipantDirectory = lazy(() =>
  import("./ParticipantDirectory").then((module) => ({
    default: module.ParticipantDirectory,
  })),
);

export function StaffTools({
  tripId,
  isManager,
}: {
  tripId: string;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
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
        {isManager && <ImportExportPanel tripId={tripId} />}
        {isManager && (
          <TabPanel id="trip" className="grid gap-5 outline-none">
            <TripSettingsPanel tripId={tripId} />
          </TabPanel>
        )}
      </Tabs>
    </section>
  );
}
