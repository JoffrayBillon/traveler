import { useTripTransportQuery } from "@traveler/api/transport/queries";
import type { TravelerTripData } from "@traveler/api/trips/trip.types";
import { ticketLabel } from "@traveler/lib/trip-format";
import type { TFunction } from "i18next";
import { TripTicketDownload } from "./TripTicketDownload";

export function TripTickets({
  tripId,
  tickets,
  t,
}: {
  tripId: string;
  tickets: TravelerTripData["tickets"];
  t: TFunction;
}) {
  const { data: transport } = useTripTransportQuery(tripId);
  const group = transport?.groups.find(
    ({ id }) => id === transport.self?.groupId,
  );
  const segments = group?.segments.filter(({ mode }) => mode === "train") ?? [];
  const legacyTickets = tickets.filter(
    (ticket) => !segments.some(({ id }) => id && id === ticket.segmentId),
  );

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
      {tickets.length === 0 && segments.length === 0 && (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("noTicketsHaveBeenAddedYet")}
        </p>
      )}
      {(["outbound", "return"] as const).map((direction) => {
        const legs = segments.filter(
          (segment) => segment.direction === direction,
        );
        if (!legs.length) return null;
        return (
          <section className="grid gap-2" key={direction}>
            <h4 className="font-semibold">{t(direction)}</h4>
            <ul className="grid list-none gap-2 p-0">
              {legs.map((segment) => {
                const ticket = tickets.find(
                  ({ segmentId }) => segmentId === segment.id,
                );
                return (
                  <li
                    className="grid gap-2 rounded-card border border-border p-3"
                    key={segment.id}
                  >
                    <strong>
                      {segment.origin} → {segment.destination}
                    </strong>
                    {ticket ? (
                      <TripTicketDownload
                        ticket={ticket}
                        tripId={tripId}
                        segmentLabel={`${t(direction)} · ${segment.origin} → ${segment.destination}${segment.serviceReference ? ` · ${segment.serviceReference}` : ""}`}
                        t={t}
                      />
                    ) : (
                      <p className="text-sm text-content-muted">
                        {t("trainTicketNotYetAvailable")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {legacyTickets.length > 0 && (
        <ul className="grid list-none gap-2 p-0">
          {legacyTickets.map((ticket) => (
            <li
              className="grid gap-2 rounded-card border border-border p-3"
              key={ticket.id}
            >
              <strong>{t(ticketLabel[ticket.kind])}</strong>
              <TripTicketDownload ticket={ticket} tripId={tripId} t={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
