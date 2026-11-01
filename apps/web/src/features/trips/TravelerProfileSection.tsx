import { emptyTravelerProfile } from "@traveler/api/trips/model";
import type { TravelerTripData } from "@traveler/api/trips/trip.types";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

const TravelerProfileForm = lazy(() =>
  import("@traveler/features/profile/TravelerProfileForm").then((module) => ({
    default: module.TravelerProfileForm,
  })),
);

export function TravelerProfileSection({
  tripId,
  data,
  isComplete,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  tripId: string;
  data: TravelerTripData;
  isComplete: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean, reason?: "dismiss" | "saved") => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const profile = data.profile ?? emptyTravelerProfile;
  return (
    <Suspense fallback={<p role="status">{t("loadingTripInformation")}</p>}>
      <TravelerProfileForm
        tripId={tripId}
        isOpen={isOpen}
        isRequired={!isComplete}
        onOpenChange={onOpenChange}
        initial={{
          firstName: data.traveler.firstName,
          lastName: data.traveler.lastName,
          gender: data.traveler.gender,
          genderConfirmed: data.traveler.genderConfirmed,
          dietaryRequirements: profile.dietaryRequirements ?? "",
          allergens: profile.allergens ?? "",
          emergencyContactFirstName: profile.emergencyContactFirstName ?? "",
          emergencyContactLastName: profile.emergencyContactLastName ?? "",
          emergencyContactPhone: profile.emergencyContactPhone ?? "",
          completed: profile.completed,
        }}
        onSaved={onSaved}
      />
    </Suspense>
  );
}
