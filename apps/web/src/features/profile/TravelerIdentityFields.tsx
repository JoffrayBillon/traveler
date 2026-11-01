import { useLayoutEffect, useRef, useState } from "react";
import {
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";

export function TravelerIdentityFields({
  firstName,
  lastName,
  gender,
  onFirstNameChange,
  onLastNameChange,
  onGenderChange,
  isOpen,
}: {
  firstName: string;
  lastName: string;
  gender: "M" | "F" | null;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onGenderChange: (value: "M" | "F" | null) => void;
  isOpen: boolean;
}) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = useState(0);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const trigger = triggerRef.current;
    const updateWidth = () =>
      setPopoverWidth(trigger.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [isOpen]);

  return (
    <fieldset className="grid gap-4 border-0 p-0">
      <legend className="text-base font-bold">
        {t("personalInformation")}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          className="grid min-w-0 gap-2"
          value={firstName}
          onChange={onFirstNameChange}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("firstName")}</Label>
          <Input
            className={textFieldStyles().input()}
            autoComplete="given-name"
            maxLength={100}
          />
        </TextField>
        <TextField
          className="grid min-w-0 gap-2"
          value={lastName}
          onChange={onLastNameChange}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("lastName")}</Label>
          <Input
            className={textFieldStyles().input()}
            autoComplete="family-name"
            maxLength={100}
          />
        </TextField>
        <Select
          className="grid w-full min-w-0 gap-2 sm:col-span-2"
          selectedKey={gender}
          onSelectionChange={(key) =>
            onGenderChange(key === "M" || key === "F" ? key : null)
          }
          isRequired
        >
          <Label className="flex items-center gap-2 text-sm font-semibold text-content">
            {t("sex")}
          </Label>
          <SelectTrigger
            ref={triggerRef}
            className="min-h-11 w-full justify-between"
          >
            <SelectValue />
          </SelectTrigger>
          <Popover
            className="z-[60] min-w-0 outline-none"
            style={{ width: popoverWidth }}
          >
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem className={listBoxStyles().item()} id="M">
                {t("man")}
              </ListBoxItem>
              <ListBoxItem className={listBoxStyles().item()} id="F">
                {t("woman")}
              </ListBoxItem>
            </ListBox>
          </Popover>
          <Text
            slot="description"
            className="text-xs leading-relaxed text-content-muted"
          >
            {t("genderFieldDescription")}
          </Text>
        </Select>
      </div>
    </fieldset>
  );
}
