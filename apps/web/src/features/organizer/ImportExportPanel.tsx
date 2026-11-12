import { buttonStyles } from "@traveler/components/ui";
import { TabPanel } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { AgencySpreadsheetForm } from "./AgencySpreadsheetForm";
import { ParticipantImportForm } from "./ParticipantImportForm";
import { TravelerTicketUpload } from "./TravelerTicketUpload";

export function ImportExportPanel({
  tripId,
  isManager,
}: {
  tripId: string;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TabPanel id="imports" className="grid gap-5 outline-none">
      <TravelerTicketUpload tripId={tripId} />
      <a
        className={buttonStyles({ appearance: "secondary" })}
        href={`/api/trips/${encodeURIComponent(tripId)}/rooms/export`}
      >
        {t("exportTheRoomingSummary")}
      </a>
      {isManager && <ParticipantImportForm tripId={tripId} />}
      <AgencySpreadsheetForm tripId={tripId} />
    </TabPanel>
  );
}
