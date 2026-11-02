import type { TravelerTripData } from "@traveler/api/trips/trip.types";
import { Card } from "@traveler/components/ui";
import type { TFunction } from "i18next";

export function TripTravelDetails({
  details,
  t,
}: {
  details: TravelerTripData["details"];
  t: TFunction;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
      <Card elevation="flat" className="grid content-start gap-2 p-4">
        <span className="text-xs text-content-subtle">{t("activity")}</span>
        <strong className="block break-words text-base">
          {details?.activityProfile === "ski"
            ? t("ski")
            : details?.activityProfile === "spa"
              ? t("spa")
              : t("toBeConfirmed")}
        </strong>
        <p className="text-sm leading-relaxed text-content-muted">
          {details?.skiDayThree
            ? t("text3DaySkiPass")
            : details?.activityProfile === "ski"
              ? t("text2DaySkiPass")
              : ""}
        </p>
      </Card>
    </div>
  );
}
