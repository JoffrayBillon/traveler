import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { PageContainer } from "../../components/ui";
import type { TravelerProfile } from "../../types/profile";
import { TripWorkspace } from "../trips/TripWorkspace";
import { NotFound } from "./NotFound";

export function TripRoute({ profile }: { profile: TravelerProfile }) {
  const { t } = useTranslation();
  const { tripId = "" } = useParams();
  const trip = profile.trips.find((item) => item.tripId === tripId);
  if (!trip) return <NotFound />;
  return (
    <PageContainer as="section" spacing="regular" aria-label={trip.tripName}>
      <h1 className="sr-only" data-route-heading tabIndex={-1}>
        {trip.tripName}
      </h1>
      <div className="flex w-full items-center justify-between gap-4 max-[480px]:items-start max-[480px]:flex-col">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted no-underline hover:text-accent"
          to="/trips"
        >
          <ArrowLeft aria-hidden="true" size={17} /> {t("allMyTrips")}
        </Link>
        {trip.role !== "traveler" && (
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted no-underline hover:text-accent"
            to={`/trips/${encodeURIComponent(tripId)}/organize`}
          >
            {t("organizerTools")} <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        )}
      </div>
      <TripWorkspace
        key={`${profile.user.id}:${tripId}`}
        tripId={tripId}
        role={trip.role}
        userId={profile.user.id}
      />
    </PageContainer>
  );
}
