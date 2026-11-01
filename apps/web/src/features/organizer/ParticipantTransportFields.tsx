import {
  Checkbox,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  checkboxStyles,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";
import type { DetailsDraft } from "./participant-directory.types";
import { TransportScheduleFields } from "./TransportScheduleFields";

export function ParticipantTransportFields({
  details,
  onChange,
}: {
  details: DetailsDraft;
  onChange: <K extends keyof DetailsDraft>(
    key: K,
    value: DetailsDraft[K],
  ) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Select
        className="grid min-w-0 gap-2"
        selectedKey={details.transportMode ?? "none"}
        onSelectionChange={(key) =>
          onChange(
            "transportMode",
            key === "train" || key === "flight" || key === "none" ? key : null,
          )
        }
      >
        <Label className={textFieldStyles().label()}>
          {t("bookedTransport")}
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
            <ListBoxItem id="none" className={listBoxStyles().item()}>
              {t("noTransport")}
            </ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
      {(details.transportMode === "train" ||
        details.transportMode === "flight") && (
        <TransportScheduleFields details={details} onChange={onChange} />
      )}
      {details.transportMode === "none" && (
        <Checkbox
          className={checkboxStyles()}
          isSelected={details.carpoolPreference ?? false}
          onChange={(value) => {
            onChange("carpoolPreference", value);
            if (!value) onChange("parkingPreference", false);
          }}
        >
          {t("iAmTravelingByCarpool")}
        </Checkbox>
      )}
      {details.transportMode === "none" && details.carpoolPreference && (
        <Checkbox
          className={checkboxStyles()}
          isSelected={details.parkingPreference ?? false}
          onChange={(value) => onChange("parkingPreference", value)}
        >
          {t("iNeedAParkingSpace")}
        </Checkbox>
      )}
    </>
  );
}
