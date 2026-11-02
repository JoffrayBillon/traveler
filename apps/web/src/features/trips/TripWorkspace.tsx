import { emptyTravelerProfile } from "@traveler/api/trips/model";
import { useTravelerTripQuery } from "@traveler/api/trips/queries";
import { eyebrowStyles, Stack } from "@traveler/components/ui";
import { roleLabel } from "@traveler/lib/trip-format";
import type { TripRole } from "@traveler/types/profile";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { TravelerProfileSection } from "./TravelerProfileSection";
import { TripTickets } from "./TripTickets";
import { TripTransportSection } from "./TripTransportSection";
import { TripTravelDetails } from "./TripTravelDetails";

const RoomingPanel = lazy(() =>
  import("@traveler/features/rooming/RoomingPanel").then((module) => ({
    default: module.RoomingPanel,
  })),
);

export function TripWorkspace({
  tripId,
  role,
  userId,
}: {
  tripId: string;
  role: TripRole;
  userId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tripQuery = useTravelerTripQuery(tripId);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);

  if (tripQuery.isPending)
    return <p role="status">{t("loadingTripInformation")}</p>;
  if (tripQuery.isError || !tripQuery.data)
    return <p role="alert">{t("tripInformationIsCurrentlyUnavailable")}</p>;

  const data = tripQuery.data;
  const profile = data.profile ?? emptyTravelerProfile;
  const isProfileComplete = Boolean(
    profile.completed && data.traveler.genderConfirmed,
  );

  return (
    <Stack gap="xl">
      <header className="flex items-start justify-between gap-4 max-[420px]:flex-col">
        <div className="grid gap-1">
          <p className={eyebrowStyles()}>{data.trip.name}</p>
          <h2 className="text-2xl font-bold tracking-tight">{t("yourTrip")}</h2>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("informationSharedByYourOrganizers")}
          </p>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-content">
          {t(roleLabel[role])}
        </span>
      </header>

      <TravelerProfileSection
        tripId={tripId}
        data={data}
        isComplete={isProfileComplete}
        isOpen={!isProfileComplete || isProfileEditorOpen}
        onOpenChange={(isOpen, reason) => {
          if (isOpen) {
            setIsProfileEditorOpen(true);
            return;
          }
          setIsProfileEditorOpen(false);
          if (!isProfileComplete && reason !== "saved") {
            const historyIndex = window.history.state?.idx;
            if (typeof historyIndex === "number" && historyIndex > 0) {
              navigate(-1);
            } else {
              navigate("/trips", { replace: true });
            }
          }
        }}
        onSaved={() => setIsProfileEditorOpen(false)}
      />

      <TripTravelDetails details={data.details} t={t} />
      <TripTransportSection tripId={tripId} />
      <TripTickets tripId={tripId} tickets={data.tickets} t={t} />
      <Suspense fallback={<p role="status">{t("loadingRoomAssignments")}</p>}>
        <RoomingPanel tripId={tripId} userId={userId} role={role} />
      </Suspense>
    </Stack>
  );
}
