import {
  formatImportReviewValue,
  importChangeLabel,
  importReviewFieldLabel,
} from "@traveler/api/imports/formatters";
import type {
  ImportPreview,
  ImportSourceType,
} from "@traveler/api/imports/import.types";
import { checkboxStyles, textFieldStyles } from "@traveler/components/ui";
import { useState } from "react";
import { Checkbox, Input, Label, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";

type ReviewRow = NonNullable<ImportPreview["changes"]>[number];

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function RegistrationImportReview({
  rows,
  source,
}: {
  rows: ReviewRow[];
  source: ImportSourceType;
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [showUnchanged, setShowUnchanged] = useState(false);
  const query = normalize(search);
  const visible = rows
    .filter(
      (row) =>
        (showUnchanged || row.action !== "unchanged") &&
        normalize(`${row.firstName} ${row.lastName} ${row.reference}`).includes(
          query,
        ),
    )
    .sort(
      (a, b) => Number(b.action === "removed") - Number(a.action === "removed"),
    );

  return (
    <section className="grid gap-4">
      <h3 className="text-base font-bold">{t("changesByReference")}</h3>
      <p className="text-sm text-content-muted">
        {source === "validated_roster"
          ? t("rosterReviewDescription")
          : t("orderReviewDescription")}
      </p>
      <TextField value={search} onChange={setSearch} className="grid gap-2">
        <Label className={textFieldStyles().label()}>
          {t("searchImportRows")}
        </Label>
        <Input type="search" className={textFieldStyles().input()} />
      </TextField>
      <Checkbox
        className={checkboxStyles()}
        isSelected={showUnchanged}
        onChange={setShowUnchanged}
      >
        {t("showUnchangedImportRows")}
      </Checkbox>
      {visible.length === 0 ? (
        <p role="status" className="text-sm text-content-muted">
          {t("noImportRowsToShow")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((row) => (
            <li
              key={row.reference}
              className="grid gap-3 rounded-card border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="wrap-anywhere font-semibold">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="wrap-anywhere text-sm text-content-muted">
                    {t("reference")} {row.reference}
                    {row.row === null
                      ? ""
                      : ` · ${t("importExcelRow", { row: row.row })}`}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold">
                  {importChangeLabel(row.action, t)}
                </span>
              </div>
              {row.values.length > 0 && (
                <dl className="grid gap-2 text-sm">
                  {row.values.map(({ field, before, after }) => (
                    <div
                      key={field}
                      className="grid gap-1 border-t border-border pt-2 sm:grid-cols-3"
                    >
                      <dt className="font-medium">
                        {importReviewFieldLabel(field, t)}
                      </dt>
                      <dd className="wrap-anywhere text-content-muted">
                        {t("importBefore")}{" "}
                        {formatImportReviewValue(
                          field,
                          before,
                          t,
                          i18n.language,
                        )}
                      </dd>
                      <dd className="wrap-anywhere">
                        {t("importAfter")}{" "}
                        {formatImportReviewValue(
                          field,
                          after,
                          t,
                          i18n.language,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
