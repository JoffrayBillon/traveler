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
}: {
  rows: TransportRow[];
  mappings: Record<string, string>;
  setMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="grid gap-3 rounded-card border border-border bg-surface p-4">
      <h6 className="text-sm font-semibold">{t("transportAssignments")}</h6>
      <ul className="grid gap-3 text-sm">
        {rows.map((row) => (
          <li className="grid gap-2" key={row.normalizedCity}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{row.sourceCity}</span>
              <span className="text-content-muted">
                {t("participantsCount", { count: row.participantCount })}
              </span>
            </div>
            {row.action === "matched" ? (
              <p className="text-content-muted">
                {t("existingTransportGroupWillBeUsed", {
                  group: row.groupName ?? row.sourceCity,
                })}
              </p>
            ) : row.action === "create_draft" ? (
              <p className="text-content-muted">
                {t("draftTransportGroupWillBeCreated")}
              </p>
            ) : (
              <Select
                className="grid min-w-0 gap-2"
                selectedKey={mappings[row.normalizedCity] ?? null}
                onSelectionChange={(key) =>
                  setMappings((current) => {
                    const next = { ...current };
                    if (key === null) delete next[row.normalizedCity];
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
