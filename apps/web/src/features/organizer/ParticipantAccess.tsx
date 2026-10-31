import { useCallback, useEffect, useState } from "react";
import { Button, messageStyles } from "../../components/ui";

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
        const retryAfter = Number.parseInt(
          response.headers.get("Retry-After") ?? "",
          10,
        );
        const seconds =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30;
        setMessage(
          `Un lien vient d’être envoyé. Réessayez dans ${seconds} secondes.`,
        );
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
    <section className="my-4" aria-labelledby="participant-access-title">
      <div className="mb-5 flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div>
          <h4
            className="mb-1 text-base font-bold"
            id="participant-access-title"
          >
            Accès des participants
          </h4>
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Suivez leur première connexion et renvoyez un lien si besoin.
          </p>
        </div>
      </div>
      {status === "loading" ? (
        <p role="status">Chargement des participants…</p>
      ) : status === "error" ? (
        <p role="alert">La liste des participants est indisponible.</p>
      ) : participants.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
          Aucun participant importé pour ce voyage.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {participants.map((participant) => (
            <li
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 max-[480px]:items-stretch max-[480px]:flex-col"
              key={participant.userId}
            >
              <div className="grid min-w-0 gap-1">
                <strong>
                  {participant.firstName} {participant.lastName}
                </strong>
                <span className="break-words text-sm text-[var(--muted)]">
                  {participant.email}
                </span>
                <span className="text-xs text-[var(--quiet)]">
                  {participant.lastLoginAt
                    ? `Dernière connexion le ${formatLoginDate(participant.lastLoginAt)}`
                    : "Pas encore connecté"}
                </span>
              </div>
              <Button
                appearance="secondary"
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
        <p className={messageStyles()} role="status" aria-live="polite">
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
