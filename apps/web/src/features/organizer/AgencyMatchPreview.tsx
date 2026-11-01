import { useTranslation } from "react-i18next";
import type { ImportPreview } from "./import-types";

type AgencyRow = NonNullable<ImportPreview["agencyRows"]>[number];

export function AgencyMatchPreview({ rows }: { rows: AgencyRow[] }) {
  const { t } = useTranslation();
  return (
    <div className="grid max-h-64 gap-2 overflow-auto text-sm">
      {rows.map((person) => (
        <p
          className="rounded-lg border border-border bg-surface p-3"
          key={`${person.row}-${person.lastName}-${person.firstName}`}
        >
          <strong>
            {person.firstName} {person.lastName}
          </strong>
          <span className="block text-content-muted">
            {person.matchCount === 1
              ? t("seatsOutboundpreviousOutboundReturnReturnpreviousReturn", {
                  outboundPrevious: person.previousOutboundSeat ?? "—",
                  outbound: person.outboundSeat ?? "—",
                  returnPrevious: person.previousReturnSeat ?? "—",
                  return: person.returnSeat ?? "—",
                })
              : person.matchCount === 0
                ? t("noMatchingAccountWasFoundCheckTheExactSpelling")
                : t("severalAccountsHaveThisNameCheckTheNamesInTheSpreadsheet")}
          </span>
        </p>
      ))}
    </div>
  );
}
