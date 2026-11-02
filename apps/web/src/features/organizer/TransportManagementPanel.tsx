import { useTripTransportQuery } from "@traveler/api/transport/queries";
import { Button, Card, messageStyles } from "@traveler/components/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TransportAssignmentTable } from "./TransportAssignmentTable";
import { TransportGroupEditor } from "./TransportGroupEditor";

export function TransportManagementPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const query = useTripTransportQuery(tripId);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (query.isPending)
    return <p role="status">{t("loadingTransportGroups")}</p>;
  if (query.isError)
    return <p role="alert">{t("transportGroupsCouldNotBeLoaded")}</p>;

  const { groups, participants, drivers } = query.data;
  const passengerCount = drivers.reduce(
    (total, driver) => total + driver.passengerCount,
    0,
  );
  const undecidedCarpoolCount = participants.filter(
    (participant) => participant.carpoolRole === "undecided",
  ).length;

  return (
    <section
      className="grid gap-5"
      aria-labelledby="transport-management-title"
    >
      <header className="grid gap-1">
        <h3 className="text-lg font-bold" id="transport-management-title">
          {t("groupTransport")}
        </h3>
        <p className="text-sm leading-relaxed text-content-muted">
          {t("groupTransportManagementDescription")}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card spacing="compact" arrangement="stack">
          <span className="text-sm text-content-muted">
            {t("transportGroups")}
          </span>
          <strong className="text-2xl">{groups.length}</strong>
        </Card>
        <Card spacing="compact" arrangement="stack">
          <span className="text-sm text-content-muted">
            {t("carsDeclared")}
          </span>
          <strong className="text-2xl">{drivers.length}</strong>
        </Card>
        <Card spacing="compact" arrangement="stack">
          <span className="text-sm text-content-muted">
            {t("carpoolPassengers")}
          </span>
          <strong className="text-2xl">{passengerCount}</strong>
          {undecidedCarpoolCount > 0 && (
            <span className="text-xs text-content-muted">
              {t("carpoolRoleNeedsSelection", { count: undecidedCarpoolCount })}
            </span>
          )}
        </Card>
      </div>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-base font-bold">{t("transportGroups")}</h4>
          <Button
            appearance="secondary"
            onPress={() => {
              setEditingGroupId(null);
              setCreatingGroup((value) => !value);
            }}
          >
            {creatingGroup ? t("cancel") : t("createTransportGroup")}
          </Button>
        </div>
        {creatingGroup && (
          <TransportGroupEditor
            tripId={tripId}
            onClose={() => setCreatingGroup(false)}
            onMessage={setMessage}
          />
        )}
        {groups.length === 0 && !creatingGroup && (
          <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
            {t("noTransportGroupsYet")}
          </p>
        )}
        {groups.map((group) =>
          editingGroupId === group.id ? (
            <TransportGroupEditor
              key={group.id}
              tripId={tripId}
              group={group}
              onClose={() => setEditingGroupId(null)}
              onMessage={setMessage}
            />
          ) : (
            <Card
              as="article"
              spacing="compact"
              arrangement="stack"
              key={group.id}
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
                <Button
                  appearance="secondary"
                  onPress={() => {
                    setCreatingGroup(false);
                    setEditingGroupId(group.id);
                  }}
                >
                  {t("edit")}
                </Button>
              </div>
              <div className="grid gap-1 text-sm text-content-muted">
                <span>
                  {t("outbound")}:{" "}
                  {
                    group.segments.filter(
                      (segment) => segment.direction === "outbound",
                    ).length
                  }{" "}
                  {t("transportSegmentsCount", {
                    count: group.segments.filter(
                      (segment) => segment.direction === "outbound",
                    ).length,
                  })}
                  {group.outboundMeetingPlace
                    ? ` · ${group.outboundMeetingPlace}`
                    : ""}
                </span>
                <span>
                  {t("return")}:{" "}
                  {
                    group.segments.filter(
                      (segment) => segment.direction === "return",
                    ).length
                  }{" "}
                  {t("transportSegmentsCount", {
                    count: group.segments.filter(
                      (segment) => segment.direction === "return",
                    ).length,
                  })}
                  {group.returnMeetingPlace
                    ? ` · ${group.returnMeetingPlace}`
                    : ""}
                </span>
              </div>
            </Card>
          ),
        )}
      </div>
      <TransportAssignmentTable
        tripId={tripId}
        groups={groups}
        participants={participants}
      />
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
