import { Navigate, useParams } from "react-router";
import type { TravelerProfile } from "../../types/profile";
import { OrganizerWorkspace } from "../organizer/OrganizerWorkspace";

export function OrganizerRoute({ profile }: { profile: TravelerProfile }) {
  const { tripId = "" } = useParams();
  const trip = profile.trips.find((item) => item.tripId === tripId);
  if (!trip) return <Navigate to="/trips" replace />;
  if (trip.role === "traveler")
    return <Navigate to={`/trips/${encodeURIComponent(tripId)}`} replace />;
  return (
    <OrganizerWorkspace
      tripId={tripId}
      tripName={trip.tripName}
      role={trip.role}
    />
  );
}
