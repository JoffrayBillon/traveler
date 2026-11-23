import type { TravelerTripData } from "@traveler/api/trips/trip.types";
import { buttonStyles } from "@traveler/components/ui";
import { getLocale } from "@traveler/i18n";
import { formatBytes, ticketLabel } from "@traveler/lib/trip-format";
import type { TFunction } from "i18next";

export function TripTicketDownload({
  ticket,
  tripId,
  segmentLabel,
  t,
}: {
  ticket: TravelerTripData["tickets"][number];
  tripId: string;
  segmentLabel?: string;
  t: TFunction;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="grid min-w-0 gap-1">
        {ticket.seatLabel && (
          <span>{t("trainTicketSeatLabel", { seat: ticket.seatLabel })}</span>
        )}
        {ticket.managedByStaff ? (
          <span className="text-content-muted">
            {t("trainTicketManagedByStaff")}
          </span>
        ) : (
          <small className="break-words text-content-muted">
            {ticket.originalName}
            {ticket.size !== null &&
              ` · ${formatBytes(ticket.size, getLocale())}`}
          </small>
        )}
      </div>
      {!ticket.managedByStaff && (
        <a
          className={buttonStyles({ appearance: "secondary" })}
          href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticket.id)}`}
          aria-label={
            segmentLabel
              ? `${t("download")} ${segmentLabel}`
              : `${t("download")} ${t(ticketLabel[ticket.kind])} : ${ticket.originalName}`
          }
        >
          {t("download")}
        </a>
      )}
    </div>
  );
}
