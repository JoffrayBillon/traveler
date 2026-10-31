import { useCallback, useEffect, useState } from "react";
import { Button } from "react-aria-components";

type ParticipantAccessRecord = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "traveler" | "companion" | "manager";
  lastLoginAt: string | null;
};

export function ParticipantAccess({ tripId }: { tripId: string }) {
  const [participants, setParticipants] = useState<ParticipantAccessRecord[]>(
    [],
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadParticipants = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/participants/access`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unable to load participants");
      const result = (await response.json()) as {
        participants: ParticipantAccessRecord[];
      };
      setParticipants(result.participants);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [tripId]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  async function sendLoginLink(userId: string) {
    setSendingId(userId);
    setMessage("");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/participants/${encodeURIComponent(userId)}/login-link`,
        { method: "POST" },
      );
      if (response.status === 429) {
        setMessage("Un lien vient d’être envoyé. Réessayez dans 30 secondes.");
        return;
      }
      if (!response.ok) throw new Error("Unable to send sign-in link");
      setMessage("Le lien de connexion a été envoyé à cette personne.");
    } catch {
      setMessage("Le lien n’a pas pu être envoyé. Réessayez plus tard.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <section
      className="participant-access"
      aria-labelledby="participant-access-title"
    >
      <div className="section-heading">
        <div>
          <h4 id="participant-access-title">Accès des participants</h4>
          <p>Suivez leur première connexion et renvoyez un lien si besoin.</p>
        </div>
      </div>
      {status === "loading" ? (
        <p role="status">Chargement des participants…</p>
      ) : status === "error" ? (
        <p role="alert">La liste des participants est indisponible.</p>
      ) : participants.length === 0 ? (
        <p className="empty-state">Aucun participant importé pour ce voyage.</p>
      ) : (
        <ul className="participant-access-list">
          {participants.map((participant) => (
            <li key={participant.userId}>
              <div className="participant-access-person">
                <strong>
                  {participant.firstName} {participant.lastName}
                </strong>
                <span>{participant.email}</span>
                <span className="detail-label">
                  {participant.lastLoginAt
                    ? `Dernière connexion le ${formatLoginDate(participant.lastLoginAt)}`
                    : "Pas encore connecté"}
                </span>
              </div>
              <Button
                className="secondary-action"
                onPress={() => void sendLoginLink(participant.userId)}
                isDisabled={sendingId !== null}
              >
                {sendingId === participant.userId
                  ? "Envoi…"
                  : participant.lastLoginAt
                    ? "Renvoyer un lien"
                    : "Envoyer un lien"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="form-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}

function formatLoginDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
