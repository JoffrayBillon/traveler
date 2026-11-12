import type { TravelerTripData } from "@traveler/api/trips/trip.types";
import { buttonStyles } from "@traveler/components/ui";
import { getLocale } from "@traveler/i18n";
import { formatBytes, ticketLabel } from "@traveler/lib/trip-format";
import type { TFunction } from "i18next";

export function TripTickets({
  tripId,
  tickets,
  t,
}: {
  tripId: string;
  tickets: TravelerTripData["tickets"];
  t: TFunction;
}) {
  return (
    <section className="grid gap-4" aria-labelledby="tickets-title">
      <header className="grid gap-1">
        <h3 className="text-lg font-bold" id="tickets-title">
          {t("travelTickets")}
        </h3>
        <p className="text-sm leading-relaxed text-content-muted">
          {t("yourDocumentsAreAvailableOnlyAfterSigningIn")}
        </p>
      </header>
      {tickets.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("noTicketsHaveBeenAddedYet")}
        </p>
      ) : (
        <ul className="grid list-none gap-2 p-0">
          {tickets.map((ticket) => (
            <li
              className="flex items-center justify-between gap-4 rounded-card border border-border p-3 max-[420px]:flex-col max-[420px]:items-start"
              key={ticket.id}
            >
              <span className="grid min-w-0 gap-1">
                <strong>{t(ticketLabel[ticket.kind])}</strong>
                <small className="break-words text-content-muted">
                  {ticket.originalName} ·{" "}
                  {formatBytes(ticket.size, getLocale())}
                </small>
              </span>
              <a
                className={buttonStyles({
                  appearance: "secondary",
                  class: "shrink-0",
                })}
                href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticket.id)}`}
                aria-label={`${t("download")} ${t(ticketLabel[ticket.kind])} : ${ticket.originalName}`}
              >
                {t("download")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
