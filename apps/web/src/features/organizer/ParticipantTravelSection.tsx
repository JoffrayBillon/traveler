import type { DetailsDraft } from "@traveler/api/participants/participant-form.types";
import type {
  TransportGroup,
  TransportView,
} from "@traveler/api/transport/transport.types";
import { useTranslation } from "react-i18next";
import { ParticipantActivityFields } from "./ParticipantActivityFields";
import { ParticipantTransportField } from "./ParticipantTransportField";

export function ParticipantTravelSection({
  details,
  groups,
  drivers,
  participantId,
  isTransportLoading,
  onChange,
}: {
  details: DetailsDraft;
  groups: TransportGroup[];
  drivers: TransportView["drivers"];
  participantId: string;
  isTransportLoading: boolean;
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
        {t("tripOptions")}
      </h3>
      <ParticipantActivityFields details={details} onChange={onChange} />
      <ParticipantTransportField
        details={details}
        groups={groups}
        drivers={drivers}
        participantId={participantId}
        isLoading={isTransportLoading}
        onChange={onChange}
      />
    </section>
  );
}
