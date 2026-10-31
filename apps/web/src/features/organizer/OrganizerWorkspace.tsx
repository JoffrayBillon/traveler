import { ArrowLeft, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { eyebrowStyles } from "../../components/ui";
import { StaffTools } from "./StaffTools";

export function OrganizerWorkspace({
  tripId,
  tripName: initialTripName,
  role,
  onTripNameChange,
}: {
  tripId: string;
  tripName: string;
  role: "companion" | "manager";
  onTripNameChange: (name: string) => void;
}) {
  const [tripName, setTripName] = useState(initialTripName);
  return (
    <section
      className="mx-auto my-12 mb-20 w-[min(100%-3rem,1120px)] max-[760px]:my-6 max-[760px]:mb-12 max-[760px]:w-[min(100%-2rem,1120px)]"
      aria-labelledby="organizer-title"
    >
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] no-underline hover:text-[var(--forest-bright)]"
        to={`/trips/${encodeURIComponent(tripId)}`}
      >
        <ArrowLeft aria-hidden="true" size={17} /> Retour au voyage
      </Link>
      <div className="my-6 flex items-center justify-start gap-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--surface-soft)] text-[var(--forest-bright)]">
          <Settings2 aria-hidden="true" size={22} />
        </span>
        <div>
          <p className={eyebrowStyles()}>{tripName}</p>
          <h1
            className="my-1 text-[clamp(2rem,4vw,3.4rem)] tracking-[-0.06em]"
            id="organizer-title"
          >
            Espace organisation
          </h1>
          <p className="mb-0 text-[var(--muted)]">
            Les outils partagés par l’équipe du séjour.
          </p>
        </div>
      </div>
      <StaffTools
        tripId={tripId}
        tripName={tripName}
        isManager={role === "manager"}
        onTripNameChange={(name) => {
          setTripName(name);
          onTripNameChange(name);
        }}
      />
    </section>
  );
}
