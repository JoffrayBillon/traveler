import type { TFunction } from "i18next";
import { Card } from "../../components/ui";
import { transportLabel } from "../../lib/trip-format";
import { JourneyCard } from "./JourneyCard";
import type { TravelerTripData } from "./traveler-trip.types";

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
      <Card elevation="flat" className="grid content-start gap-2 p-4">
        <span className="text-xs text-content-subtle">{t("transport")}</span>
        <strong className="block break-words text-base">
          {t(transportLabel[details?.transportMode ?? ""] ?? "toBeConfirmed")}
        </strong>
        <p className="text-sm leading-relaxed text-content-muted">
          {details?.departureCity ??
            details?.outboundLocation ??
            t("theOrganizersWillAddThisInformation")}
        </p>
      </Card>
      <JourneyCard
        direction="outbound"
        dateTime={details?.outboundDateTime}
        departureTime={details?.outboundDepartureTime}
        meetingTime={details?.outboundMeetingTime}
        location={details?.outboundLocation}
        reference={details?.outboundReference}
        seat={details?.outboundSeat}
        t={t}
      />
      <JourneyCard
        direction="return"
        dateTime={details?.returnDateTime}
        departureTime={details?.returnDepartureTime}
        meetingTime={details?.returnMeetingTime}
        location={details?.returnLocation}
        reference={details?.returnReference}
        seat={details?.returnSeat}
        t={t}
      />
    </div>
  );
}
