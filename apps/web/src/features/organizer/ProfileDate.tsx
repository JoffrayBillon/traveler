import { parseDate } from "@internationalized/date";
import { Button, textFieldStyles } from "@traveler/components/ui";
import { getLocale } from "@traveler/i18n";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  I18nProvider,
  Label,
  Popover,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function ProfileDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const parsedValue = value ? parseDate(value) : null;

  return (
    <I18nProvider locale={getLocale()}>
      <DatePicker
        className="grid min-w-0 gap-2"
        granularity="day"
        value={parsedValue}
        onChange={(date) => onChange(date?.toString() ?? "")}
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
          <Button
            appearance="quiet"
            aria-label={t("openDatePicker")}
            className="size-9 min-h-0 shrink-0 rounded-control px-0"
          >
            <CalendarDays aria-hidden="true" size={17} />
          </Button>
        </Group>
        <Popover className="rounded-card border border-border bg-surface p-3 text-content shadow-panel">
          <Dialog className="outline-none">
            <Calendar className="grid gap-3">
              <header className="flex items-center justify-between gap-3">
                <Button
                  slot="previous"
                  appearance="quiet"
                  aria-label={t("previousMonth")}
                  className="size-9 min-h-0 rounded-control px-0"
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </Button>
                <CalendarHeading className="text-sm font-semibold" />
                <Button
                  slot="next"
                  appearance="quiet"
                  aria-label={t("nextMonth")}
                  className="size-9 min-h-0 rounded-control px-0"
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </Button>
              </header>
              <CalendarGrid className="border-separate border-spacing-1">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className="size-9 text-center text-xs font-medium text-content-muted">
                      {day}
                    </CalendarHeaderCell>
                  )}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => (
                    <CalendarCell
                      className="grid size-9 cursor-pointer place-items-center rounded-control text-sm outline-none transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus data-[outside-month]:text-content-muted/50 data-[selected]:bg-surface-muted data-[selected]:font-semibold data-[selected]:text-content data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
                      date={date}
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}
