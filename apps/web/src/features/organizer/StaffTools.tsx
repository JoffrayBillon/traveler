import { useReducedMotion } from "motion/react";
import { lazy, Suspense } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { ImportExportPanel } from "./ImportExportPanel";
import { TabSelectionIndicator } from "./TabSelectionIndicator";
import { TripSettingsPanel } from "./TripSettingsPanel";

const ParticipantDirectory = lazy(() =>
  import("./ParticipantDirectory").then((module) => ({
    default: module.ParticipantDirectory,
  })),
);
const TransportOverviewPanel = lazy(() =>
  import("./TransportOverviewPanel").then((module) => ({
    default: module.TransportOverviewPanel,
  })),
);
const RoomingPanel = lazy(() =>
  import("@traveler/features/rooming/RoomingPanel").then((module) => ({
    default: module.RoomingPanel,
  })),
);

export function StaffTools({
  tripId,
  userId,
  isManager,
}: {
  tripId: string;
  userId: string;
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
          <Tab
            id="transport"
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
                  {t("groupTransport")}
                </span>
              </>
            )}
          </Tab>
          <Tab
            id="rooms"
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
                  {t("roomPlan")}
                </span>
              </>
            )}
          </Tab>
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
        </TabPanel>
        <TabPanel id="transport" className="grid gap-5 outline-none">
          <Suspense
            fallback={<p role="status">{t("loadingTransportGroups")}</p>}
          >
            <TransportOverviewPanel tripId={tripId} />
          </Suspense>
        </TabPanel>
        <TabPanel id="rooms" className="grid gap-5 outline-none">
          <Suspense
            fallback={<p role="status">{t("loadingRoomAssignments")}</p>}
          >
            <RoomingPanel tripId={tripId} userId={userId} view="organizer" />
          </Suspense>
        </TabPanel>
        <ImportExportPanel tripId={tripId} isManager={isManager} />
        {isManager && (
          <TabPanel id="trip" className="grid gap-5 outline-none">
            <TripSettingsPanel tripId={tripId} />
          </TabPanel>
        )}
      </Tabs>
    </section>
  );
}
