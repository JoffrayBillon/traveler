import { ArrowLeft, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [tripName, setTripName] = useState(initialTripName);
  useEffect(() => {
    setTripName(initialTripName);
  }, [initialTripName]);
  return (
    <section
      className="mx-auto grid w-[min(100%-3rem,1320px)] gap-6 py-12 max-[760px]:w-[min(100%-2rem,1320px)] max-[760px]:py-6"
      aria-labelledby="organizer-title"
    >
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted no-underline hover:text-accent"
        to={`/trips/${encodeURIComponent(tripId)}`}
      >
        <ArrowLeft aria-hidden="true" size={17} /> {t("backToTrip")}
      </Link>
      <div className="flex items-center justify-start gap-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-card bg-surface-muted text-accent">
          <Settings2 aria-hidden="true" size={22} />
        </span>
        <div className="grid gap-1">
          <p className={eyebrowStyles()}>{tripName}</p>
          <h1
            className="text-[clamp(2rem,4vw,3.4rem)] tracking-[-0.06em]"
            id="organizer-title"
            data-route-heading
            tabIndex={-1}
          >
            {t("organizerSpace")}
          </h1>
          <p className="text-content-muted">
            {t("toolsSharedByTheTripOrganizers")}
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
