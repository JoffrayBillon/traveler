import { useTranslation } from "react-i18next";
import { getLocale } from "../../i18n";
import { formatMoney } from "./participant-formatters";
import type { StaffTraveler } from "./types";

export function ParticipantPaymentSection({
  participant,
  isManager,
}: {
  participant: StaffTraveler;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  if (!isManager || !participant.paymentStatus) return null;
  return (
    <section className="grid gap-2 border-t border-border pt-5">
      <h3 className="text-base font-bold">{t("payment")}</h3>
      <p className="text-sm text-content-muted">
        {t("paymentStatus", { status: t(participant.paymentStatus) })} ·{" "}
        {t("amountPaid")}:{" "}
        {formatMoney(participant.amountPaidMinor, getLocale())} ·{" "}
        {t("amountRemaining", {
          amount: formatMoney(participant.amountDueMinor, getLocale()),
        })}
      </p>
    </section>
  );
}
