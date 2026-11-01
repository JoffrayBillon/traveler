import { type FormEvent, useEffect, useState } from "react";
import { Checkbox, Form } from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  checkboxStyles,
  messageStyles,
} from "../../components/ui";
import { useSaveCarpoolPreferencesMutation } from "./trip-mutations";

export function CarpoolPreferences({
  tripId,
  carpoolPreference,
  parkingPreference,
}: {
  tripId: string;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
}) {
  const { t } = useTranslation();
  const [carpool, setCarpool] = useState(carpoolPreference ?? false);
  const [parking, setParking] = useState(parkingPreference ?? false);
  const [message, setMessage] = useState("");
  const savePreferencesMutation = useSaveCarpoolPreferencesMutation(tripId);

  useEffect(() => {
    setCarpool(carpoolPreference ?? false);
    setParking(parkingPreference ?? false);
  }, [carpoolPreference, parkingPreference]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await savePreferencesMutation.mutateAsync({
        carpoolPreference: carpool,
        parkingPreference: carpool && parking,
      });
      setMessage(t("yourPreferencesHaveBeenSaved"));
    } catch {
      setMessage(t("yourPreferencesCouldNotBeSaved"));
    }
  }

  return (
    <Card
      as="section"
      spacing="compact"
      arrangement="stack"
      aria-labelledby="carpool-title"
    >
      <h3 className="text-lg font-bold" id="carpool-title">
        {t("noTransportBooked")}
      </h3>
      <p className="text-sm leading-relaxed text-content-muted">
        {t("tellUsWhetherYouNeedACarpoolAndIfSoAParkingSpace")}
      </p>
      <Form className="grid justify-items-start gap-3" onSubmit={save}>
        <Checkbox
          className={checkboxStyles()}
          isSelected={carpool}
          isDisabled={savePreferencesMutation.isPending}
          onChange={(selected) => {
            setCarpool(selected);
            if (!selected) setParking(false);
          }}
        >
          <span>{t("iAmTravelingByCarpool")}</span>
        </Checkbox>
        {carpool && (
          <Checkbox
            className={checkboxStyles()}
            isSelected={parking}
            isDisabled={savePreferencesMutation.isPending}
            onChange={setParking}
          >
            <span>{t("iNeedAParkingSpace")}</span>
          </Checkbox>
        )}
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={savePreferencesMutation.isPending}
        >
          {savePreferencesMutation.isPending
            ? t("saving")
            : t("saveMyPreferences")}
        </Button>
      </Form>
      {message && (
        <p className={messageStyles()} role="status">
          {message}
        </p>
      )}
    </Card>
  );
}
