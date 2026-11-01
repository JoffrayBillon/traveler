import type { DetailsDraft } from "@traveler/api/participants/participant-form.types";
import { useTranslation } from "react-i18next";
import { ParticipantActivityFields } from "./ParticipantActivityFields";
import { ParticipantTransportFields } from "./ParticipantTransportFields";

export function ParticipantTravelSection({
  details,
  onChange,
}: {
  details: DetailsDraft;
  onChange: <K extends keyof DetailsDraft>(
    key: K,
    value: DetailsDraft[K],
  ) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="grid gap-4 border-t border-border pt-5"
      aria-labelledby="user-trip-details-title"
    >
      <h3 className="text-base font-bold" id="user-trip-details-title">
        {t("transportAndOptions")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <ParticipantActivityFields details={details} onChange={onChange} />
        <ParticipantTransportFields details={details} onChange={onChange} />
      </div>
    </section>
  );
}
