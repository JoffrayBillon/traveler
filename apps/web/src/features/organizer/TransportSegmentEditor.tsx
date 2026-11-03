import type { TransportSegment } from "@traveler/api/transport/transport.types";
import {
  Button,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import {
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { ProfileDateTime } from "./ProfileDateTime";
import { ProfileText } from "./ProfileText";

export function TransportSegmentEditor({
  segment,
  onChange,
  onRemove,
}: {
  segment: TransportSegment;
  onChange: (segment: TransportSegment) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-3 rounded-card border border-border p-4">
      <legend className="px-2 text-sm font-semibold text-content">
        {t(segment.direction === "outbound" ? "outbound" : "return")}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={segment.direction}
          onSelectionChange={(key) => {
            if (key === "outbound" || key === "return")
              onChange({ ...segment, direction: key });
          }}
        >
          <Label className={textFieldStyles().label()}>{t("journey")}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem id="outbound" className={listBoxStyles().item()}>
                {t("outbound")}
              </ListBoxItem>
              <ListBoxItem id="return" className={listBoxStyles().item()}>
                {t("return")}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={segment.mode}
          onSelectionChange={(key) => {
            if (key === "train" || key === "flight")
              onChange({ ...segment, mode: key });
          }}
        >
          <Label className={textFieldStyles().label()}>
            {t("transportMode")}
          </Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem id="train" className={listBoxStyles().item()}>
                {t("train")}
              </ListBoxItem>
              <ListBoxItem id="flight" className={listBoxStyles().item()}>
                {t("plane")}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileText
          label={t("origin")}
          value={segment.origin}
          onChange={(origin) => onChange({ ...segment, origin })}
        />
        <ProfileText
          label={t("destination")}
          value={segment.destination}
          onChange={(destination) => onChange({ ...segment, destination })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileDateTime
          label={t("departureDateAndTime")}
          value={segment.departureAt ?? ""}
          onChange={(departureAt) =>
            onChange({ ...segment, departureAt: departureAt || null })
          }
        />
        <ProfileDateTime
          label={t("arrivalDateAndTime")}
          value={segment.arrivalAt ?? ""}
          onChange={(arrivalAt) =>
            onChange({ ...segment, arrivalAt: arrivalAt || null })
          }
        />
      </div>
      <ProfileText
        label={t("serviceReference")}
        value={segment.serviceReference ?? ""}
        onChange={(serviceReference) =>
          onChange({ ...segment, serviceReference: serviceReference || null })
        }
      />
      <Button appearance="quietDanger" onPress={onRemove}>
        {t("removeSegment")}
      </Button>
    </fieldset>
  );
}
