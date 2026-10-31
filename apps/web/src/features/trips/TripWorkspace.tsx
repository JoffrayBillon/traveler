import { type FormEvent, useEffect, useState } from "react";
import { Button, Checkbox, Form } from "react-aria-components";
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
    <div className="trip-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{data.trip.name}</p>
          <h2>Votre séjour</h2>
          <p>Les informations partagées par l’équipe d’organisation.</p>
        </div>
        <span className="role-chip">{roleLabel[role]}</span>
      </div>
      <div className="details-grid">
        <article className="detail-card">
          <span className="detail-label">Activité</span>
          <strong>
            {details?.activityProfile === "ski"
              ? "Ski"
              : details?.activityProfile === "spa"
                ? "Spa"
                : "À confirmer"}
          </strong>
          <p>
            {details?.skiDayThree
              ? "Forfait ski 3 jours"
              : details?.activityProfile === "ski"
                ? "Forfait ski 2 jours"
                : ""}
          </p>
        </article>
        <article className="detail-card">
          <span className="detail-label">Transport</span>
          <strong>
            {transportLabel[details?.transportMode ?? ""] ?? "À confirmer"}
          </strong>
          <p>
            {details?.departureCity ??
              details?.outboundLocation ??
              "Les informations seront ajoutées par l’équipe."}
          </p>
        </article>
        <article className="detail-card">
          <span className="detail-label">Aller</span>
          <strong>
            {formatDate(
              details?.outboundDateTime ?? details?.outboundDepartureTime,
            )}
          </strong>
          <p>
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
        <article className="detail-card">
          <span className="detail-label">Retour</span>
          <strong>
            {formatDate(
              details?.returnDateTime ?? details?.returnDepartureTime,
            )}
          </strong>
          <p>
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
      <section className="ticket-section" aria-labelledby="tickets-title">
        <div className="section-heading">
          <div>
            <h3 id="tickets-title">Titres de transport</h3>
            <p>Vos documents sont disponibles uniquement après connexion.</p>
          </div>
        </div>
        {data.tickets.length === 0 ? (
          <p className="empty-state">Aucun billet n’a encore été ajouté.</p>
        ) : (
          <ul className="ticket-list">
            {data.tickets.map((ticket) => (
              <li key={ticket.id}>
                <span>
                  <strong>{ticketLabel[ticket.kind]}</strong>
                  <small>
                    {ticket.originalName} · {formatBytes(ticket.size)}
                  </small>
                </span>
                <a
                  className="ticket-download"
                  href={`/api/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticket.id)}`}
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

  useEffect(() => {
    setCarpool(carpoolPreference ?? false);
    setParking(parkingPreference ?? false);
  }, [carpoolPreference, parkingPreference]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
  }

  return (
    <section className="carpool-card" aria-labelledby="carpool-title">
      <h3 id="carpool-title">Sans transport réservé</h3>
      <p>
        Indiquez si vous cherchez un covoiturage et, si oui, une place de
        parking.
      </p>
      <Form onSubmit={save}>
        <Checkbox
          isSelected={carpool}
          onChange={(selected) => {
            setCarpool(selected);
            if (!selected) setParking(false);
          }}
        >
          <span>Je viens en covoiturage</span>
        </Checkbox>
        {carpool && (
          <Checkbox isSelected={parking} onChange={setParking}>
            <span>Je demande une place de parking</span>
          </Checkbox>
        )}
        <Button className="secondary-action" type="submit">
          Enregistrer mes préférences
        </Button>
      </Form>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
