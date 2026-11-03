import { useTripTransportQuery } from "@traveler/api/transport/queries";
import { Button, Card, messageStyles } from "@traveler/components/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TransportGroupEditor } from "./TransportGroupEditor";

export function TransportGroupSettingsPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const query = useTripTransportQuery(tripId);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (query.isPending)
    return <p role="status">{t("loadingTransportGroups")}</p>;
  if (query.isError)
    return <p role="alert">{t("transportGroupsCouldNotBeLoaded")}</p>;

  const { groups } = query.data;

  return (
    <section className="grid gap-3" aria-labelledby="transport-settings-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h4 className="text-base font-bold" id="transport-settings-title">
            {t("groupTransport")}
          </h4>
          <p className="text-sm leading-relaxed text-content-muted">
            {t("groupTransportManagementDescription")}
          </p>
        </div>
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
                  {group.sourceCity}
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
          </Card>
        ),
      )}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
