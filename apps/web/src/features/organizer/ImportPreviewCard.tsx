import { useTranslation } from "react-i18next";
import { Button, Card } from "../../components/ui";
import { AgencyMatchPreview } from "./AgencyMatchPreview";
import { ImportStaffAccountMapping } from "./ImportStaffAccountMapping";
import { importChangeLabel, importSummaryLabel } from "./import-formatters";
import type { ImportPreview } from "./import-types";

export function ImportPreviewCard({
  importPreview,
  managerEmails,
  toggleManagerEmail,
  accountMappings,
  setAccountMappings,
  onCommit,
  isCommitting,
}: {
  importPreview: ImportPreview | null;
  managerEmails: string[];
  toggleManagerEmail: (email: string) => void;
  accountMappings: Record<string, string>;
  setAccountMappings: (
    update: (current: Record<string, string>) => Record<string, string>,
  ) => void;
  onCommit: () => void;
  isCommitting: boolean;
}) {
  const { t } = useTranslation();
  if (!importPreview) return null;

  const isBlocked = Boolean(
    importPreview.summary.unmatched || importPreview.summary.ambiguous,
  );
  return (
    <Card
      className="col-span-full"
      spacing="compact"
      arrangement="stack"
      tone="muted"
      elevation="flat"
    >
      <h5 className="text-sm font-bold">{t("importPreview")}</h5>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {Object.entries(importPreview.summary).map(([key, value]) => (
          <div key={key}>
            <dt className="text-content-muted">{importSummaryLabel(key, t)}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {importPreview.changes?.length ? (
        <section className="grid max-h-72 gap-1 overflow-auto rounded-lg border border-border bg-surface p-3 text-sm">
          <h6 className="font-semibold">{t("changesByReference")}</h6>
          {importPreview.changes.map((change) => (
            <p
              className="border-t border-border py-2"
              key={`${change.reference}-${change.action}`}
            >
              <strong>{change.reference}</strong>
              <span> · {importChangeLabel(change.action, t)}</span>
              {change.fields.length > 0 && (
                <span className="text-content-muted">
                  {" "}
                  — {change.fields.map((field) => t(field)).join(", ")}
                </span>
              )}
            </p>
          ))}
        </section>
      ) : null}
      {importPreview.staffRows?.length ? (
        <ImportStaffAccountMapping
          staffRows={importPreview.staffRows}
          members={importPreview.availableMembers ?? []}
          managerEmails={managerEmails}
          toggleManagerEmail={toggleManagerEmail}
          accountMappings={accountMappings}
          setAccountMappings={setAccountMappings}
        />
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
