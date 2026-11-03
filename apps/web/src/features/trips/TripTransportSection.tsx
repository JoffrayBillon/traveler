import { useTripTransportQuery } from "@traveler/api/transport/queries";
import { Card } from "@traveler/components/ui";
import { getLocale } from "@traveler/i18n";
import { formatJourneyDate } from "@traveler/lib/trip-format";
import { useTranslation } from "react-i18next";
import { CarpoolPreferences } from "./CarpoolPreferences";

export function TripTransportSection({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const query = useTripTransportQuery(tripId);
  if (query.isPending)
    return <p role="status">{t("loadingTransportDetails")}</p>;
  if (query.isError)
    return <p role="alert">{t("transportDetailsCouldNotBeLoaded")}</p>;

  const { groups, self, drivers } = query.data;
  if (!self) return null;
  const group = self.groupId
    ? groups.find((candidate) => candidate.id === self.groupId)
    : undefined;

  return (
    <section className="grid gap-3" aria-labelledby="trip-transport-title">
      <h3 className="text-lg font-bold" id="trip-transport-title">
        {t("transport")}
      </h3>
      {group ? (
        <Card as="article" spacing="comfortable" arrangement="stack">
          <header className="grid gap-1">
            <span className="text-xs text-content-subtle">
              {group.sourceCity}
            </span>
            <h4 className="text-lg font-bold">{group.name}</h4>
            {group.isDraft && (
              <p className="text-sm text-content-muted">
                {t("transportDetailsToCome")}
              </p>
            )}
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <JourneySummary group={group} direction="outbound" />
            <JourneySummary group={group} direction="return" />
          </div>
        </Card>
      ) : self.transportChoice === "none" ? (
        <CarpoolPreferences tripId={tripId} self={self} drivers={drivers} />
      ) : (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("theOrganizersWillAddThisInformation")}
        </p>
      )}
    </section>
  );
}

function JourneySummary({
  group,
  direction,
}: {
  group: NonNullable<
    ReturnType<typeof useTripTransportQuery>["data"]
  >["groups"][number];
  direction: "outbound" | "return";
}) {
  const { t } = useTranslation();
  const segments = group.segments.filter(
    (segment) => segment.direction === direction,
  );
  const meetingAt =
    direction === "outbound" ? group.outboundMeetingAt : group.returnMeetingAt;
  const meetingPlace =
    direction === "outbound"
      ? group.outboundMeetingPlace
      : group.returnMeetingPlace;
  return (
    <section className="grid content-start gap-3 rounded-card border border-border p-4">
      <h5 className="font-semibold">{t(direction)}</h5>
      <div className="grid gap-1 text-sm text-content-muted">
        <p>
          {t("meeting")}: {formatTransportDate(meetingAt, t("toBeConfirmed"))}
        </p>
        <p>{meetingPlace ?? t("theOrganizersWillAddThisInformation")}</p>
      </div>
      {segments.length ? (
        <ol className="grid gap-3">
          {segments.map((segment) => (
            <li
              className="grid gap-1 border-t border-border pt-3"
              key={segment.id}
            >
              <strong>
                {t(segment.mode === "train" ? "train" : "plane")} ·{" "}
                {segment.origin} → {segment.destination}
              </strong>
              <span className="text-sm text-content-muted">
                {t("departure")}:{" "}
                {formatTransportDate(segment.departureAt, t("toBeConfirmed"))}
              </span>
              {segment.arrivalAt && (
                <span className="text-sm text-content-muted">
                  {t("arrival")}:{" "}
                  {formatTransportDate(segment.arrivalAt, t("toBeConfirmed"))}
                </span>
              )}
              {segment.serviceReference && (
                <span className="text-sm text-content-muted">
                  {t("reference")}: {segment.serviceReference}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-content-muted">
          {t("transportSegmentsToCome")}
        </p>
      )}
    </section>
  );
}

function formatTransportDate(value: string | null, pendingLabel: string) {
  return formatJourneyDate(value, null, getLocale(), pendingLabel);
}
