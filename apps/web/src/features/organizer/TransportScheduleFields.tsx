import { useTranslation } from "react-i18next";
import { ProfileDateTime } from "./ProfileDateTime";
import { ProfileText } from "./ProfileText";
import { ProfileTime } from "./ProfileTime";
import type { DetailsDraft } from "./participant-directory.types";

export function TransportScheduleFields({
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
    <>
      <ProfileText
        label={t("departureCity")}
        value={details.departureCity ?? ""}
        onChange={(value) => onChange("departureCity", value || null)}
      />
      <ProfileDateTime
        label={t("outboundDateAndTime")}
        value={details.outboundDateTime ?? ""}
        onChange={(value) => onChange("outboundDateTime", value || null)}
      />
      <ProfileTime
        label={t("outboundMeetingTime")}
        value={details.outboundMeetingTime ?? ""}
        onChange={(value) => onChange("outboundMeetingTime", value || null)}
      />
      <ProfileTime
        label={t("outboundDepartureTime")}
        value={details.outboundDepartureTime ?? ""}
        onChange={(value) => onChange("outboundDepartureTime", value || null)}
      />
      <ProfileText
        label={t("outboundLocation")}
        value={details.outboundLocation ?? ""}
        onChange={(value) => onChange("outboundLocation", value || null)}
      />
      <ProfileText
        label={t("outboundReference")}
        value={details.outboundReference ?? ""}
        onChange={(value) => onChange("outboundReference", value || null)}
      />
      <ProfileText
        label={t("outboundSeat")}
        value={details.outboundSeat ?? ""}
        onChange={(value) => onChange("outboundSeat", value || null)}
      />
      <ProfileDateTime
        label={t("returnDateAndTime")}
        value={details.returnDateTime ?? ""}
        onChange={(value) => onChange("returnDateTime", value || null)}
      />
      <ProfileTime
        label={t("returnMeetingTime")}
        value={details.returnMeetingTime ?? ""}
        onChange={(value) => onChange("returnMeetingTime", value || null)}
      />
      <ProfileTime
        label={t("returnDepartureTime")}
        value={details.returnDepartureTime ?? ""}
        onChange={(value) => onChange("returnDepartureTime", value || null)}
      />
      <ProfileText
        label={t("returnLocation")}
        value={details.returnLocation ?? ""}
        onChange={(value) => onChange("returnLocation", value || null)}
      />
      <ProfileText
        label={t("returnReference")}
        value={details.returnReference ?? ""}
        onChange={(value) => onChange("returnReference", value || null)}
      />
      <ProfileText
        label={t("returnSeat")}
        value={details.returnSeat ?? ""}
        onChange={(value) => onChange("returnSeat", value || null)}
      />
    </>
  );
}
