import { OrganizerWorkspace } from "@traveler/features/organizer/OrganizerWorkspace";
import type { TravelerProfile } from "@traveler/types/profile";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import { PageTitle } from "./PageTitle";

export function OrganizerRoute({ profile }: { profile: TravelerProfile }) {
  const { t } = useTranslation();
  const { tripId = "" } = useParams();
  const trip = profile.trips.find((item) => item.tripId === tripId);
  if (!trip) return <Navigate to="/trips" replace />;
  if (trip.role === "traveler")
    return <Navigate to={`/trips/${encodeURIComponent(tripId)}`} replace />;
  return (
    <>
      <PageTitle title={`${t("organizerSpace")} · ${trip.tripName}`} />
      <OrganizerWorkspace
        tripId={tripId}
        tripName={trip.tripName}
        role={trip.role}
        userId={profile.user.id}
      />
    </>
  );
}
