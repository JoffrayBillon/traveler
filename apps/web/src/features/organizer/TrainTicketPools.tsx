import type { TransportGroup } from "@traveler/api/transport/transport.types";
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
import { TrainTicketPoolEditor } from "./TrainTicketPoolEditor";

export function TrainTicketPools({
  tripId,
  groups,
}: {
  tripId: string;
  groups: TransportGroup[];
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const trains = groups.flatMap((group) =>
    group.segments.flatMap((segment) =>
      segment.mode === "train" && segment.id
        ? [
            {
              id: segment.id,
              label: `${group.name} · ${t(segment.direction)} · ${segment.origin} → ${segment.destination}${segment.serviceReference ? ` · ${segment.serviceReference}` : ""}`,
            },
          ]
        : [],
    ),
  );
  if (!trains.length) return null;
  const segmentId = trains.some((train) => train.id === selected)
    ? selected
    : (trains[0]?.id ?? null);

  return (
    <section className="grid gap-4" aria-labelledby="train-ticket-pools">
      <h4 id="train-ticket-pools" className="text-base font-bold">
        {t("trainTicketPool")}
      </h4>
      <Select
        className="grid min-w-0 max-w-xl gap-2"
        selectedKey={segmentId}
        onSelectionChange={(key) => setSelected(key ? String(key) : null)}
      >
        <Label className={textFieldStyles().label()}>
          {t("trainTicketSegment")}
        </Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <Popover>
          <ListBox className={listBoxStyles().list()} items={trains}>
            {(train) => (
              <ListBoxItem className={listBoxStyles().item()}>
                {train.label}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
      {segmentId && (
        <TrainTicketPoolEditor
          key={segmentId}
          tripId={tripId}
          segmentId={segmentId}
        />
      )}
    </section>
  );
}
