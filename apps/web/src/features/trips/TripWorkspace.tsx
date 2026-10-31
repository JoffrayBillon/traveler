import { type FormEvent, useEffect, useState } from "react";
import { Checkbox, Form } from "react-aria-components";
import {
  Button,
  buttonStyles,
  checkboxStyles,
  eyebrowStyles,
  messageStyles,
} from "../../components/ui";
import {
  formatBytes,
  formatDate,
  roleLabel,
  ticketLabel,
  transportLabel,
} from "../../lib/trip-format";
import type { TripRole } from "../../types/profile";
import { RoomingPanel } from "../rooming/RoomingPanel";

type TravelerTripData = {
  trip: { id: string; name: string };
  traveler: {
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
    role: "traveler" | "companion" | "manager";
  };
  details: null | {
    activityProfile: "ski" | "spa" | null;
    skiDayThree: boolean;
    transportMode: "train" | "flight" | "none" | null;
    departureCity: string | null;
    outboundDateTime: string | null;
    outboundTimezone: string | null;
    outboundMeetingTime: string | null;
    outboundDepartureTime: string | null;
    outboundLocation: string | null;
    outboundReference: string | null;
    outboundSeat: string | null;
    returnDateTime: string | null;
    returnTimezone: string | null;
    returnMeetingTime: string | null;
    returnDepartureTime: string | null;
    returnLocation: string | null;
    returnReference: string | null;
    returnSeat: string | null;
    carpoolPreference: boolean | null;
    parkingPreference: boolean | null;
    updatedAt: string | null;
  };
  tickets: {
    id: string;
    kind: "outbound" | "return" | "other";
    originalName: string;
    size: number;
    createdAt: string;
  }[];
};

export function TripWorkspace({
  tripId,
  role,
  userId,
}: {
  tripId: string;
  role: TripRole;
  userId: string;
}) {
  const [data, setData] = useState<TravelerTripData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setData(null);
    fetch(`/api/trips/${encodeURIComponent(tripId)}/traveler`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Trip information unavailable");
        return (await response.json()) as TravelerTripData;
      })
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  if (status === "loading")
    return <p role="status">Chargement des informations du voyage…</p>;
  if (status === "unavailable" || !data)
    return (
      <p role="alert">
        Les informations du voyage ne sont pas accessibles pour le moment.
      </p>
    );

  const details = data.details;
  return (
    <div className="w-full">
      <div className="mb-5 flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div>
          <p className={eyebrowStyles()}>{data.trip.name}</p>
          <h2 className="mb-1 mt-1 text-2xl font-bold tracking-tight">
            Votre séjour
          </h2>
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Les informations partagées par l’équipe d’organisation.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)]">
          {roleLabel[role]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
        <article className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <span className="text-xs text-[var(--quiet)]">Activité</span>
          <strong className="mt-2 block break-words text-base">
            {details?.activityProfile === "ski"
              ? "Ski"
              : details?.activityProfile === "spa"
                ? "Spa"
                : "À confirmer"}
          </strong>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {details?.skiDayThree
              ? "Forfait ski 3 jours"
              : details?.activityProfile === "ski"
                ? "Forfait ski 2 jours"
                : ""}
          </p>
        </article>
        <article className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <span className="text-xs text-[var(--quiet)]">Transport</span>
          <strong className="mt-2 block break-words text-base">
            {transportLabel[details?.transportMode ?? ""] ?? "À confirmer"}
          </strong>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {details?.departureCity ??
              details?.outboundLocation ??
              "Les informations seront ajoutées par l’équipe."}
          </p>
        </article>
        <article className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <span className="text-xs text-[var(--quiet)]">Aller</span>
          <strong className="mt-2 block break-words text-base">
            {formatJourneyDate(
              details?.outboundDateTime,
              details?.outboundDepartureTime,
            )}
          </strong>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {[
              details?.outboundMeetingTime &&
                `Rendez-vous ${details.outboundMeetingTime}`,
              details?.outboundLocation,
              details?.outboundReference && `Réf. ${details.outboundReference}`,
              details?.outboundSeat && `Place ${details.outboundSeat}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Informations à venir"}
          </p>
        </article>
        <article className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <span className="text-xs text-[var(--quiet)]">Retour</span>
          <strong className="mt-2 block break-words text-base">
            {formatJourneyDate(
              details?.returnDateTime,
              details?.returnDepartureTime,
            )}
          </strong>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {[
              details?.returnMeetingTime &&
                `Rendez-vous ${details.returnMeetingTime}`,
              details?.returnLocation,
              details?.returnReference && `Réf. ${details.returnReference}`,
              details?.returnSeat && `Place ${details.returnSeat}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Informations à venir"}
          </p>
        </article>
      </div>
      <section className="mt-7" aria-labelledby="tickets-title">
        <div className="mb-5 flex items-start justify-between gap-4 max-[420px]:flex-col">
          <div>
            <h3 className="mb-1 text-lg font-bold" id="tickets-title">
              Titres de transport
            </h3>
            <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
              Vos documents sont disponibles uniquement après connexion.
            </p>
          </div>
        </div>
        {data.tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            Aucun billet n’a encore été ajouté.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {data.tickets.map((ticket) => (
              <li
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] p-3 max-[420px]:flex-col max-[420px]:items-start"
                key={ticket.id}
              >
                <span className="grid min-w-0 gap-1">
                  <strong>{ticketLabel[ticket.kind]}</strong>
                  <small className="break-words text-[var(--muted)]">
                    {ticket.originalName} · {formatBytes(ticket.size)}
                  </small>
                </span>
                <a
                  className={buttonStyles({
                    appearance: "secondary",
                    class: "shrink-0",
                  })}
                  href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticket.id)}`}
                  aria-label={`Télécharger ${ticketLabel[ticket.kind]} : ${ticket.originalName}`}
                >
                  Télécharger
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <RoomingPanel tripId={tripId} userId={userId} role={role} />
      {details?.transportMode === "none" && (
        <CarpoolPreferences
          tripId={tripId}
          carpoolPreference={details.carpoolPreference}
          parkingPreference={details.parkingPreference}
          onSaved={(carpoolPreference, parkingPreference) =>
            setData((current) =>
              current?.details
                ? {
                    ...current,
                    details: {
                      ...current.details,
                      carpoolPreference,
                      parkingPreference,
                    },
                  }
                : current,
            )
          }
        />
      )}
    </div>
  );
}

function CarpoolPreferences({
  tripId,
  carpoolPreference,
  parkingPreference,
  onSaved,
}: {
  tripId: string;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
  onSaved: (carpoolPreference: boolean, parkingPreference: boolean) => void;
}) {
  const [carpool, setCarpool] = useState(carpoolPreference ?? false);
  const [parking, setParking] = useState(parkingPreference ?? false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCarpool(carpoolPreference ?? false);
    setParking(parkingPreference ?? false);
  }, [carpoolPreference, parkingPreference]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/carpool-preferences`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carpoolPreference: carpool,
            parkingPreference: carpool && parking,
          }),
        },
      );
      if (!response.ok) {
        setMessage("Vos préférences n’ont pas pu être enregistrées.");
        return;
      }
      onSaved(carpool, carpool && parking);
      setMessage("Vos préférences ont été enregistrées.");
    } catch {
      setMessage("Vos préférences n’ont pas pu être enregistrées.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="mt-7 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
      aria-labelledby="carpool-title"
    >
      <h3 className="mb-1 text-lg font-bold" id="carpool-title">
        Sans transport réservé
      </h3>
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Indiquez si vous cherchez un covoiturage et, si oui, une place de
        parking.
      </p>
      <Form className="mt-4 grid justify-items-start gap-3" onSubmit={save}>
        <Checkbox
          className={checkboxStyles()}
          isSelected={carpool}
          isDisabled={isSaving}
          onChange={(selected) => {
            setCarpool(selected);
            if (!selected) setParking(false);
          }}
        >
          <span>Je viens en covoiturage</span>
        </Checkbox>
        {carpool && (
          <Checkbox
            className={checkboxStyles()}
            isSelected={parking}
            isDisabled={isSaving}
            onChange={setParking}
          >
            <span>Je demande une place de parking</span>
          </Checkbox>
        )}
        <Button appearance="secondary" type="submit" isDisabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer mes préférences"}
        </Button>
      </Form>
      {message && (
        <p className={messageStyles()} role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function formatJourneyDate(
  dateTime: string | null | undefined,
  departureTime: string | null | undefined,
) {
  if (!dateTime) return formatDate(departureTime);
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
  const timeLabel =
    departureTime ??
    new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}
