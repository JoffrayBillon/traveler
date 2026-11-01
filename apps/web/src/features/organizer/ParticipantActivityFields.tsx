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

export function ParticipantActivityFields({
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
        selectedKey={details.activityProfile ?? "none"}
        onSelectionChange={(key) => {
          const activity = key === "ski" || key === "spa" ? key : null;
          onChange("activityProfile", activity);
          if (activity !== "ski") onChange("skiDayThree", false);
        }}
      >
        <Label className={textFieldStyles().label()}>{t("package")}</Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <Popover>
          <ListBox className={listBoxStyles().list()}>
            <ListBoxItem id="none" className={listBoxStyles().item()}>
              {t("notProvided")}
            </ListBoxItem>
            <ListBoxItem id="ski" className={listBoxStyles().item()}>
              {t("ski")}
            </ListBoxItem>
            <ListBoxItem id="spa" className={listBoxStyles().item()}>
              {t("spa")}
            </ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
      {details.activityProfile === "ski" && (
        <Checkbox
          className={`${checkboxStyles()} col-span-full`}
          isSelected={details.skiDayThree}
          onChange={(value) => onChange("skiDayThree", value)}
        >
          {t("skiOnDayThree")}
        </Checkbox>
      )}
    </>
  );
}
