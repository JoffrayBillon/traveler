import type { TFunction } from "i18next";
import { Card } from "../../components/ui";
import { getLocale } from "../../i18n";
import { formatJourneyDate } from "../../lib/trip-format";

export function JourneyCard({
  direction,
  dateTime,
  departureTime,
  meetingTime,
  location,
  reference,
  seat,
  t,
}: {
  direction: "outbound" | "return";
  dateTime?: string | null | undefined;
  departureTime?: string | null | undefined;
  meetingTime?: string | null | undefined;
  location?: string | null | undefined;
  reference?: string | null | undefined;
  seat?: string | null | undefined;
  t: TFunction;
}) {
  const info = [
    meetingTime && `${t("meeting")} ${meetingTime}`,
    location,
    reference && `${t("ref")} ${reference}`,
    seat && `${t("seat")} ${seat}`,
  ]
    .filter(Boolean)
    .join(" ·");

  return (
    <Card elevation="flat" className="grid content-start gap-2 p-4">
      <span className="text-xs text-content-subtle">{t(direction)}</span>
      <strong className="block break-words text-base">
        {formatJourneyDate(
          dateTime,
          departureTime,
          getLocale(),
          t("toBeConfirmed"),
        )}
      </strong>
      <p className="text-sm leading-relaxed text-content-muted">
        {info || t("informationToCome")}
      </p>
    </Card>
  );
}
