import { importSummaryLabel } from "@traveler/api/imports/formatters";
import type { ImportPreview } from "@traveler/api/imports/import.types";
import { Button, Card } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";
import { AgencyMatchPreview } from "./AgencyMatchPreview";
import { ImportStaffAccountMapping } from "./ImportStaffAccountMapping";
import { ImportStaffTransportPreview } from "./ImportStaffTransportPreview";
import { RegistrationImportReview } from "./RegistrationImportReview";

export function ImportPreviewCard({
  importPreview,
  excludedRows,
  setExcludedRows,
  managerEmails,
  toggleManagerEmail,
  accountMappings,
  setAccountMappings,
  transportMappings,
  setTransportMappings,
  onCommit,
  isCommitting,
}: {
  importPreview: ImportPreview | null;
  excludedRows: number[];
  setExcludedRows: (update: (current: number[]) => number[]) => void;
  managerEmails: string[];
  toggleManagerEmail: (email: string) => void;
  accountMappings: Record<string, string>;
  setAccountMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
  transportMappings: Record<string, string>;
  setTransportMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
  onCommit: () => void;
  isCommitting: boolean;
}) {
  const { t } = useTranslation();
  if (!importPreview) return null;

  const excluded = new Set(excludedRows);
  const includedStaffRows = (importPreview.staffRows ?? []).filter(
    (row) => !excluded.has(row.row),
  );
  const transportRows = importPreview.staffTransportRows ?? [];
  const includedTransportRows = importPreview.staffRows
    ? transportRows
        .map((row) => ({
          ...row,
          participantCount: includedStaffRows.filter(
            (staffRow) =>
              staffRow.normalizedTransportCity === row.normalizedCity,
          ).length,
        }))
        .filter((row) => row.participantCount > 0)
    : transportRows;
  const summary = { ...importPreview.summary };
  if (importPreview.staffRows) {
    summary.rows = includedStaffRows.length;
    summary.groupedParticipants = includedStaffRows.filter(
      (row) => row.transportMode !== "none",
    ).length;
    summary.noTransportParticipants = includedStaffRows.filter(
      (row) => row.transportMode === "none",
    ).length;
    summary.matchedGroups = includedTransportRows.filter(
      (row) => row.action === "matched",
    ).length;
    summary.draftGroups = includedTransportRows.filter(
      (row) => row.action === "create_draft",
    ).length;
    summary.ambiguousCities = includedTransportRows.filter(
      (row) => row.action === "choose_group",
    ).length;
  }

  const isBlocked =
    (Boolean(importPreview.staffRows?.length) &&
      includedStaffRows.length === 0) ||
    Boolean(
      importPreview.summary.unmatched || importPreview.summary.ambiguous,
    ) ||
    Boolean(
      includedTransportRows.some(
        (row) =>
          row.action === "choose_group" &&
          !transportMappings[row.normalizedCity],
      ),
    );
  return (
    <Card
      className="col-span-full"
      spacing="compact"
      arrangement="stack"
      tone="muted"
      elevation="flat"
    >
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {Object.keys(summary).map((key) => (
          <div key={key}>
            <dt className="text-content-muted">{importSummaryLabel(key, t)}</dt>
            <dd className="font-semibold">{summary[key]}</dd>
          </div>
        ))}
      </dl>
      {includedTransportRows.length ? (
        <ImportStaffTransportPreview
          rows={includedTransportRows}
          allowOverride={importPreview.sourceType === "detailed_orders"}
          mappings={transportMappings}
          setMappings={setTransportMappings}
        />
      ) : null}
      {importPreview.changes && (
        <RegistrationImportReview
          rows={importPreview.changes}
          source={importPreview.sourceType}
        />
      )}
      {importPreview.staffRows?.length ? (
        <ImportStaffAccountMapping
          staffRows={importPreview.staffRows}
          members={importPreview.availableMembers ?? []}
          excludedRows={excludedRows}
          setExcludedRows={setExcludedRows}
          managerEmails={managerEmails}
          toggleManagerEmail={toggleManagerEmail}
          accountMappings={accountMappings}
          setAccountMappings={setAccountMappings}
        />
      ) : null}
      {importPreview.staffRows?.length && includedStaffRows.length === 0 ? (
        <p className="text-sm text-content-muted" role="status">
          {t("selectAtLeastOneRowToImport")}
        </p>
      ) : null}
      {importPreview.agencyRows?.length ? (
        <AgencyMatchPreview rows={importPreview.agencyRows} />
      ) : null}
      <Button
        appearance="primary"
        type="button"
        isDisabled={isBlocked || isCommitting}
        onPress={onCommit}
      >
        {t("confirmImport")}
      </Button>
    </Card>
  );
}
