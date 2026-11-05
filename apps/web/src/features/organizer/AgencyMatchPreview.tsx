import type { ImportPreview } from "@traveler/api/imports/import.types";
import { useTranslation } from "react-i18next";

type AgencyRow = NonNullable<ImportPreview["agencyRows"]>[number];

function changesSeat(row: AgencyRow) {
  return (
    (row.outboundSeat ?? row.previousOutboundSeat) !==
      row.previousOutboundSeat ||
    (row.returnSeat ?? row.previousReturnSeat) !== row.previousReturnSeat
  );
}

export function AgencyMatchPreview({ rows }: { rows: AgencyRow[] }) {
  const { t } = useTranslation();
  const blocked = rows.filter((row) => row.matchCount !== 1);
  const matched = rows.filter((row) => row.matchCount === 1);
  const changed = matched.filter(changesSeat);
  const unchanged = matched.filter((row) => !changesSeat(row));

  function renderRows(items: AgencyRow[]) {
    return (
      <ul className="grid gap-2">
        {items.map((person) => (
          <li
            className="grid gap-2 rounded-card border border-border bg-surface p-4 text-sm"
            key={person.row}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>
                {person.firstName} {person.lastName}
              </strong>
              <span className="text-content-muted">
                {t("importExcelRow", { row: person.row })}
              </span>
            </div>
            {person.matchCount !== 1 ? (
              <p>
                {person.matchCount === 0
                  ? t("noMatchingAccountWasFoundCheckTheExactSpelling")
                  : t(
                      "severalAccountsHaveThisNameCheckTheNamesInTheSpreadsheet",
                    )}
              </p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">{t("outboundPlacements")}</dt>
                  <dd>
                    {t("importBefore")} {person.previousOutboundSeat ?? "—"}
                  </dd>
                  <dd>
                    {t("importAfter")}{" "}
                    {person.outboundSeat ?? person.previousOutboundSeat ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">{t("returnPlacements")}</dt>
                  <dd>
                    {t("importBefore")} {person.previousReturnSeat ?? "—"}
                  </dd>
                  <dd>
                    {t("importAfter")}{" "}
                    {person.returnSeat ?? person.previousReturnSeat ?? "—"}
                  </dd>
                </div>
              </dl>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="grid gap-4">
      <p className="text-sm text-content-muted">
        {t("agencyReviewDescription")}
      </p>
      {blocked.length > 0 && (
        <div className="grid gap-2">
          <h3 className="font-bold">{t("agencyReviewBlocked")}</h3>
          {renderRows(blocked)}
        </div>
      )}
      <h3 className="font-bold">
        {t("agencySeatChanges")} ({changed.length})
      </h3>
      {changed.length ? (
        renderRows(changed)
      ) : (
        <p className="text-sm text-content-muted">{t("noImportRowsToShow")}</p>
      )}
      {unchanged.length > 0 && (
        <details className="grid gap-2">
          <summary className="cursor-pointer font-semibold">
            {t("agencySeatUnchanged")} ({unchanged.length})
          </summary>
          {renderRows(unchanged)}
        </details>
      )}
    </section>
  );
}
