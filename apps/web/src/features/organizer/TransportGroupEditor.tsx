import { ApiError } from "@traveler/api/client";
import { useTransportMutations } from "@traveler/api/transport/mutations";
import type {
  TransportGroup,
  TransportGroupInput,
  TransportSegment,
} from "@traveler/api/transport/transport.types";
import { Button, Card } from "@traveler/components/ui";
import { type FormEvent, useEffect, useState } from "react";
import { Form } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { ProfileDateTime } from "./ProfileDateTime";
import { ProfileText } from "./ProfileText";
import { TransportSegmentEditor } from "./TransportSegmentEditor";

const emptyGroup: TransportGroupInput = {
  name: "",
  sourceCity: "",
  outboundMeetingAt: null,
  outboundMeetingPlace: null,
  returnMeetingAt: null,
  returnMeetingPlace: null,
  segments: [],
};

export function TransportGroupEditor({
  tripId,
  group,
  onClose,
  onMessage,
}: {
  tripId: string;
  group?: TransportGroup;
  onClose: () => void;
  onMessage: (message: string) => void;
}) {
  const { t } = useTranslation();
  const mutations = useTransportMutations(tripId);
  const [draft, setDraft] = useState<TransportGroupInput>(toInput(group));

  useEffect(() => setDraft(toInput(group)), [group]);

  function update<K extends keyof TransportGroupInput>(
    key: K,
    value: TransportGroupInput[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSegment(index: number, segment: TransportSegment) {
    setDraft((current) => ({
      ...current,
      segments: current.segments.map((value, valueIndex) =>
        valueIndex === index ? segment : value,
      ),
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (group)
        await mutations.updateGroup.mutateAsync({ id: group.id, input: draft });
      else await mutations.createGroup.mutateAsync(draft);
      onMessage(t("transportGroupSaved"));
      onClose();
    } catch (error) {
      onMessage(
        error instanceof ApiError && error.code === "invalid_group"
          ? t("transportGroupInvalid")
          : t("transportGroupCouldNotBeSaved"),
      );
    }
  }

  async function deleteGroup() {
    if (!group) return;
    try {
      await mutations.deleteGroup.mutateAsync(group.id);
      onMessage(t("transportGroupDeleted"));
      onClose();
    } catch {
      onMessage(t("transportGroupCouldNotBeDeletedWithTravelersAssigned"));
    }
  }

  return (
    <Card as="section" spacing="comfortable" arrangement="stack">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h4 className="text-base font-bold">
            {group ? t("editTransportGroup") : t("createTransportGroup")}
          </h4>
          {group?.isDraft && (
            <p className="text-sm text-warning">
              {t("transportGroupNeedsDetails")}
            </p>
          )}
        </div>
        <Button appearance="quiet" onPress={onClose}>
          {t("cancel")}
        </Button>
      </header>
      <Form className="grid gap-4" onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileText
            label={t("transportGroupName")}
            value={draft.name}
            onChange={(name) => update("name", name)}
          />
          <ProfileText
            label={t("departureCity")}
            value={draft.sourceCity}
            onChange={(sourceCity) => update("sourceCity", sourceCity)}
          />
        </div>
        <div className="grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2">
          <h5 className="text-sm font-semibold sm:col-span-2">
            {t("outboundMeeting")}
          </h5>
          <ProfileDateTime
            label={t("meetingDateAndTime")}
            value={draft.outboundMeetingAt ?? ""}
            onChange={(value) => update("outboundMeetingAt", value || null)}
          />
          <ProfileText
            label={t("meetingPlace")}
            value={draft.outboundMeetingPlace ?? ""}
            onChange={(value) => update("outboundMeetingPlace", value || null)}
          />
        </div>
        <div className="grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2">
          <h5 className="text-sm font-semibold sm:col-span-2">
            {t("returnMeeting")}
          </h5>
          <ProfileDateTime
            label={t("meetingDateAndTime")}
            value={draft.returnMeetingAt ?? ""}
            onChange={(value) => update("returnMeetingAt", value || null)}
          />
          <ProfileText
            label={t("meetingPlace")}
            value={draft.returnMeetingPlace ?? ""}
            onChange={(value) => update("returnMeetingPlace", value || null)}
          />
        </div>
        <div className="grid gap-3">
          <h5 className="text-sm font-semibold">{t("transportSegments")}</h5>
          {draft.segments.map((segment, index) => (
            <TransportSegmentEditor
              key={segment.id ?? `new-${index}`}
              segment={segment}
              onChange={(value) => updateSegment(index, value)}
              onRemove={() =>
                update(
                  "segments",
                  draft.segments.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              appearance="secondary"
              onPress={() =>
                update("segments", [
                  ...draft.segments,
                  blankSegment("outbound"),
                ])
              }
            >
              {t("addOutboundSegment")}
            </Button>
            <Button
              appearance="secondary"
              onPress={() =>
                update("segments", [...draft.segments, blankSegment("return")])
              }
            >
              {t("addReturnSegment")}
            </Button>
          </div>
        </div>
        <footer className="flex flex-wrap gap-2">
          <Button
            type="submit"
            isDisabled={
              mutations.updateGroup.isPending || mutations.createGroup.isPending
            }
          >
            {t("save")}
          </Button>
          {group && (
            <Button
              appearance="quiet"
              onPress={() => void deleteGroup()}
              isDisabled={mutations.deleteGroup.isPending}
            >
              {t("deleteTransportGroup")}
            </Button>
          )}
        </footer>
      </Form>
    </Card>
  );
}

function toInput(group?: TransportGroup): TransportGroupInput {
  if (!group) return emptyGroup;
  return {
    name: group.name,
    sourceCity: group.sourceCity,
    outboundMeetingAt: group.outboundMeetingAt,
    outboundMeetingPlace: group.outboundMeetingPlace,
    returnMeetingAt: group.returnMeetingAt,
    returnMeetingPlace: group.returnMeetingPlace,
    segments: group.segments.map(
      ({ position: _position, ...segment }) => segment,
    ),
  };
}

function blankSegment(
  direction: TransportSegment["direction"],
): TransportSegment {
  return {
    direction,
    mode: "train",
    origin: "",
    destination: "",
    departureAt: null,
    arrivalAt: null,
    serviceReference: null,
  };
}
