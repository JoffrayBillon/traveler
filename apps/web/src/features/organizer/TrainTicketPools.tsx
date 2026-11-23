import type {
  TransportGroup,
  TransportSegment,
} from "@traveler/api/transport/transport.types";
import {
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { useState } from "react";
import {
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { TrainTicketImportReview } from "./TrainTicketImportReview";
import { TrainTicketPoolEditor } from "./TrainTicketPoolEditor";

export function TrainTicketPools({
  tripId,
  groups,
}: {
  tripId: string;
  groups: TransportGroup[];
}) {
  const { t } = useTranslation();
  const [groupSelection, setGroupSelection] = useState<string | null>(null);
  const [directionSelection, setDirectionSelection] = useState<
    "outbound" | "return" | null
  >(null);
  const [segmentSelection, setSegmentSelection] = useState<string | null>(null);
  const trainGroups = groups.filter((group) =>
    group.segments.some((segment) => segment.mode === "train" && segment.id),
  );
  const group =
    trainGroups.find(({ id }) => id === groupSelection) ?? trainGroups[0];
  if (!group) return null;
  const trainSegments = group.segments.filter(
    (segment): segment is TransportSegment & { id: string } =>
      segment.mode === "train" && Boolean(segment.id),
  );
  const directions = [
    ...new Set(trainSegments.map(({ direction }) => direction)),
  ];
  const direction =
    directionSelection && directions.includes(directionSelection)
      ? directionSelection
      : directions[0];
  if (!direction) return null;
  const segments = trainSegments.filter(
    (segment) => segment.direction === direction,
  );
  const segment =
    segments.find(({ id }) => id === segmentSelection) ?? segments[0];
  if (!segment) return null;
  const segmentId = segment.id;
  const field = textFieldStyles();

  return (
    <section className="grid gap-4" aria-labelledby="train-ticket-pools">
      <h4 id="train-ticket-pools" className="text-base font-bold">
        {t("trainTicketPool")}
      </h4>
      <div className="grid gap-4 md:grid-cols-3">
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={group.id}
          onSelectionChange={(key) => {
            setGroupSelection(key ? String(key) : null);
            setDirectionSelection(null);
            setSegmentSelection(null);
          }}
        >
          <Label className={field.label()}>{t("trainTicketGroup")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()} items={trainGroups}>
              {(option) => (
                <ListBoxItem id={option.id} className={listBoxStyles().item()}>
                  {option.name}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={direction}
          onSelectionChange={(key) => {
            setDirectionSelection(
              key === "outbound" || key === "return" ? key : null,
            );
            setSegmentSelection(null);
          }}
        >
          <Label className={field.label()}>{t("trainTicketDirection")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox
              className={listBoxStyles().list()}
              items={directions.map((id) => ({ id }))}
            >
              {({ id }) => (
                <ListBoxItem id={id} className={listBoxStyles().item()}>
                  {t(id)}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={segmentId}
          onSelectionChange={(key) =>
            setSegmentSelection(key ? String(key) : null)
          }
        >
          <Label className={field.label()}>{t("trainTicketSegment")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()} items={segments}>
              {(option) => (
                <ListBoxItem
                  id={option.id}
                  className={listBoxStyles().item()}
                >{`${option.origin} → ${option.destination}${option.serviceReference ? ` · ${option.serviceReference}` : ""}`}</ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
      </div>
      <div className="grid gap-5">
        <TrainTicketImportReview
          key={`imports-${segmentId}`}
          tripId={tripId}
          segmentId={segmentId}
        />
        <details className="rounded-card border border-border bg-surface-muted/40 p-4">
          <summary className="cursor-pointer font-semibold">
            {t("trainTicketManualPool")}
          </summary>
          <div className="mt-4">
            <TrainTicketPoolEditor
              key={segmentId}
              tripId={tripId}
              segmentId={segmentId}
            />
          </div>
        </details>
      </div>
    </section>
  );
}
