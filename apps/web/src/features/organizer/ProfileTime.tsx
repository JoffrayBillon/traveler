import { Button, textFieldStyles } from "@traveler/components/ui";
import { Clock3 } from "lucide-react";
import {
  DateInput,
  DateSegment,
  Group,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  TimeField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { getTimeOptions, padTime, parseTimeSafely } from "./profile-time-utils";
export function ProfileTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const parsedValue = parseTimeSafely(value);
  return (
    <TimeField
      className="grid min-w-0 gap-2"
      value={parsedValue}
      onChange={(time) =>
        onChange(time ? `${padTime(time.hour)}:${padTime(time.minute)}` : "")
      }
    >
      <Label className={textFieldStyles().label()}>{label}</Label>
      <Group className="flex min-h-11 w-full min-w-0 items-center gap-1 rounded-control border border-border bg-surface px-2 text-content outline-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <DateInput className="flex min-w-0 flex-1 items-center gap-0.5 px-1 py-2">
          {(segment) => (
            <DateSegment
              className="rounded-sm px-0.5 outline-none data-[focused]:bg-surface-muted data-[placeholder]:text-content-muted"
              segment={segment}
            />
          )}
        </DateInput>
        <Select
          aria-label={t("openTimePicker")}
          selectedKey={
            parsedValue
              ? `${padTime(parsedValue.hour)}:${padTime(parsedValue.minute)}`
              : null
          }
          onSelectionChange={(key) => {
            if (key !== null) onChange(String(key));
          }}
        >
          <Button
            slot="trigger"
            appearance="quietNeutral"
            aria-label={t("openTimePicker")}
            className="size-9 min-h-0 shrink-0 rounded-control px-0"
          >
            <Clock3 aria-hidden="true" size={17} />
          </Button>
          <Popover className="max-h-72 w-36 overflow-hidden rounded-card border border-border bg-surface p-1.5 shadow-panel">
            <ListBox
              className="grid max-h-64 gap-1 overflow-y-auto"
              items={getTimeOptions(
                parsedValue
                  ? `${padTime(parsedValue.hour)}:${padTime(parsedValue.minute)}`
                  : "",
              )}
            >
              {(time) => (
                <ListBoxItem
                  className="flex min-h-10 cursor-pointer items-center rounded-control px-3 py-2 text-sm text-content outline-none data-[focused]:bg-surface-muted data-[selected]:bg-surface-muted data-[selected]:font-semibold"
                  id={time}
                  textValue={time}
                >
                  {time}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
      </Group>
    </TimeField>
  );
}
