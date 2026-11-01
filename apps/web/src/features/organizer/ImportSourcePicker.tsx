import type { ImportSourceType } from "@traveler/api/imports/import.types";
import {
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

export function ImportSourcePicker({
  value,
  onChange,
}: {
  value: ImportSourceType;
  onChange: (value: ImportSourceType) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select
      className="col-span-full grid gap-2"
      selectedKey={value}
      onSelectionChange={(key) => key && onChange(key as ImportSourceType)}
    >
      <Label className={textFieldStyles().label()}>
        {t("spreadsheetType")}
      </Label>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <Popover>
        <ListBox className={listBoxStyles().list()}>
          <ListBoxItem className={listBoxStyles().item()} id="validated_roster">
            {t("confirmedParticipantList")}
          </ListBoxItem>
          <ListBoxItem className={listBoxStyles().item()} id="detailed_orders">
            {t("detailedOrderList")}
          </ListBoxItem>
          <ListBoxItem className={listBoxStyles().item()} id="companions_vips">
            {t("companionsAndVips")}
          </ListBoxItem>
          <ListBoxItem className={listBoxStyles().item()} id="agency_rooming">
            {t("roomingListReturnedByTheAgency")}
          </ListBoxItem>
        </ListBox>
      </Popover>
    </Select>
  );
}
