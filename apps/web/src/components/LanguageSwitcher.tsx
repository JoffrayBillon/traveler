import { Languages } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { listBoxStyles, SelectTrigger } from "./ui";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage === "en" ? "en" : "fr";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState(0);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const updateWidth = () =>
      setTriggerWidth(trigger.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(trigger);
    return () => observer.disconnect();
  }, []);
  return (
    <Select
      aria-label={t("interfaceLanguage")}
      className="grid w-full gap-2"
      selectedKey={language}
      onSelectionChange={(key) => {
        if (key === "fr" || key === "en") void i18n.changeLanguage(key);
      }}
    >
      <Label className="text-sm font-semibold text-content-muted">
        {t("interfaceLanguage")}
      </Label>
      <SelectTrigger
        ref={triggerRef}
        className="min-h-12 w-full justify-between gap-3 rounded-control px-3"
      >
        <span className="inline-flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-accent">
            <Languages aria-hidden="true" size={16} />
          </span>
          <span className="grid min-w-0 text-left">
            <span className="text-xs text-content-subtle">
              {t("chooseYourLanguage")}
            </span>
            <SelectValue className="truncate font-semibold" />
          </span>
        </span>
      </SelectTrigger>
      <Popover
        className="z-50 max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] outline-none data-[entering]:animate-[popover-in_180ms_ease-out] data-[exiting]:animate-[popover-out_120ms_ease-in]"
        style={{ width: `${triggerWidth}px` }}
      >
        <ListBox
          className={`${listBoxStyles().list()} max-h-[calc(100dvh-2.5rem)] overflow-y-auto`}
        >
          <ListBoxItem className={listBoxStyles().item()} id="fr">
            {t("french")}
          </ListBoxItem>
          <ListBoxItem className={listBoxStyles().item()} id="en">
            {t("english")}
          </ListBoxItem>
        </ListBox>
      </Popover>
    </Select>
  );
}
