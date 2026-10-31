import { ArrowLeft, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { StaffTools } from "./StaffTools";

export function OrganizerWorkspace({
  tripId,
  tripName: initialTripName,
  role,
}: {
  tripId: string;
  tripName: string;
  role: "companion" | "manager";
}) {
  const [tripName, setTripName] = useState(initialTripName);
  return (
    <section className="organizer-workspace" aria-labelledby="organizer-title">
      <Link className="back-link" to={`/trips/${encodeURIComponent(tripId)}`}>
        <ArrowLeft aria-hidden="true" size={17} /> Retour au voyage
      </Link>
      <div className="organizer-heading">
        <span className="organizer-heading-icon">
          <Settings2 aria-hidden="true" size={22} />
        </span>
        <div>
          <p className="eyebrow">{tripName}</p>
          <h1 id="organizer-title">Espace organisation</h1>
          <p>Les outils partagés par l’équipe du séjour.</p>
        </div>
      </div>
      <StaffTools
        tripId={tripId}
        tripName={tripName}
        isManager={role === "manager"}
        onTripNameChange={setTripName}
      />
    </section>
  );
}
