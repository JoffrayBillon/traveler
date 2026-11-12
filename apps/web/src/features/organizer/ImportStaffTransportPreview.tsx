import type { ImportPreview } from "@traveler/api/imports/import.types";
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

type TransportRow = NonNullable<ImportPreview["staffTransportRows"]>[number];

export function ImportStaffTransportPreview({
  rows,
  mappings,
  setMappings,
  allowOverride = false,
}: {
  rows: TransportRow[];
  allowOverride?: boolean;
  mappings: Record<string, string>;
  setMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="grid gap-3 rounded-card border border-border bg-surface p-4">
      <h6 className="text-sm font-semibold">{t("transportAssignments")}</h6>
      {allowOverride && (
        <p className="text-sm text-content-muted">
          {t("detailedTransportMappingDescription")}
        </p>
      )}
      <ul className="grid gap-3 text-sm">
        {rows.map((row) => (
          <li className="grid gap-2" key={row.normalizedCity}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{row.sourceCity}</span>
              <span className="text-content-muted">
                {t("participantsCount", { count: row.participantCount })}
              </span>
            </div>
            {!allowOverride && row.action === "matched" ? (
              <p className="text-content-muted">
                {t("existingTransportGroupWillBeUsed", {
                  group: row.groupName ?? row.sourceCity,
                })}
              </p>
            ) : row.action === "create_draft" &&
              (!allowOverride || row.candidates.length === 0) ? (
              <p className="text-content-muted">
                {t("draftTransportGroupWillBeCreated")}
              </p>
            ) : (
              <Select
                className="grid min-w-0 gap-2"
                selectedKey={
                  mappings[row.normalizedCity] ??
                  (allowOverride && row.action !== "choose_group"
                    ? "automatic"
                    : null)
                }
                onSelectionChange={(key) =>
                  setMappings((current) => {
                    const next = { ...current };
                    if (key === null || key === "automatic")
                      delete next[row.normalizedCity];
                    else next[row.normalizedCity] = String(key);
                    return next;
                  })
                }
              >
                <Label className={textFieldStyles().label()}>
                  {t("chooseTransportGroupForCity", { city: row.sourceCity })}
                </Label>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <Popover>
                  <ListBox className={listBoxStyles().list()}>
                    {allowOverride && row.action !== "choose_group" && (
                      <ListBoxItem
                        className={listBoxStyles().item()}
                        id="automatic"
                      >
                        {row.groupName
                          ? t("existingTransportGroupWillBeUsed", {
                              group: row.groupName,
                            })
                          : t("draftTransportGroupWillBeCreated")}
                      </ListBoxItem>
                    )}
                    {row.candidates.map((candidate) => (
                      <ListBoxItem
                        className={listBoxStyles().item()}
                        id={candidate.id}
                        key={candidate.id}
                      >
                        {candidate.name}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
