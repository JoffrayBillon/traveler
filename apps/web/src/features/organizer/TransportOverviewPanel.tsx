import { useTripTransportQuery } from "@traveler/api/transport/queries";
import { Card } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";

export function TransportOverviewPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const query = useTripTransportQuery(tripId);

  if (query.isPending)
    return <p role="status">{t("loadingTransportGroups")}</p>;
  if (query.isError)
    return <p role="alert">{t("transportGroupsCouldNotBeLoaded")}</p>;

  const { groups, participants, drivers } = query.data;
  const carsWithPassengers = drivers.filter(
    (driver) => driver.passengerCount > 0,
  ).length;
  const groupTravelerCount = participants.filter(
    (participant) => participant.transportChoice === "group",
  ).length;

  return (
    <section className="grid gap-5" aria-labelledby="transport-overview-title">
      <header className="grid gap-1">
        <h4 className="text-base font-bold" id="transport-overview-title">
          {t("groupTransport")}
        </h4>
        <p className="text-sm leading-relaxed text-content-muted">
          {t("groupTransportOverviewDescription")}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label={t("transportGroups")} value={groups.length} />
        <MetricCard
          label={t("groupTransportTravelers")}
          value={groupTravelerCount}
        />
        <MetricCard
          label={t("carsWithPassengers")}
          value={carsWithPassengers}
        />
      </div>
      {groups.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => {
            const outboundSegments = group.segments.filter(
              (segment) => segment.direction === "outbound",
            ).length;
            const returnSegments = group.segments.filter(
              (segment) => segment.direction === "return",
            ).length;

            return (
              <Card
                key={group.id}
                as="article"
                spacing="compact"
                arrangement="stack"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h5 className="font-semibold">{group.name}</h5>
                    <span className="text-sm text-content-muted">
                      {group.sourceCity} ·{" "}
                      {t("travelersCount", { count: group.travelers.length })}
                    </span>
                    {group.isDraft && (
                      <span className="text-sm text-warning">
                        {t("transportGroupNeedsDetails")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid gap-1 text-sm text-content-muted">
                  <span>
                    {t("outbound")}:{" "}
                    {t("transportSegmentsCount", { count: outboundSegments })}
                    {group.outboundMeetingPlace
                      ? ` · ${group.outboundMeetingPlace}`
                      : ""}
                  </span>
                  <span>
                    {t("return")}:{" "}
                    {t("transportSegmentsCount", { count: returnSegments })}
                    {group.returnMeetingPlace
                      ? ` · ${group.returnMeetingPlace}`
                      : ""}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("noTransportGroupsYet")}
        </p>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card spacing="compact" arrangement="stack">
      <span className="text-sm text-content-muted">{label}</span>
      <strong className="text-2xl">{value}</strong>
    </Card>
  );
}
