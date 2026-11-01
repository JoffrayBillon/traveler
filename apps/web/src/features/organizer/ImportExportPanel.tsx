import { buttonStyles } from "@traveler/components/ui";
import { TabPanel } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { AgencySpreadsheetForm } from "./AgencySpreadsheetForm";
import { ParticipantImportForm } from "./ParticipantImportForm";

export function ImportExportPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  return (
    <TabPanel id="imports" className="grid gap-5 outline-none">
      <ParticipantImportForm tripId={tripId} />
      <a
        className={buttonStyles({ appearance: "secondary" })}
        href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
      >
        {t("exportTheRoomingSummary")}
      </a>
      <AgencySpreadsheetForm tripId={tripId} />
    </TabPanel>
  );
}
