import { useCurrentTravelerQuery } from "@traveler/api/auth/queries";
import { useUpdateTripNameMutation } from "@traveler/api/trips/mutations";
import {
  Button,
  Card,
  messageStyles,
  textFieldStyles,
} from "@traveler/components/ui";
import { type FormEvent, lazy, Suspense, useEffect, useState } from "react";
import { Form, Input, Label, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { ProfileDate } from "./ProfileDate";
import { TripRoomInventorySettings } from "./TripRoomInventorySettings";

const TransportGroupSettingsPanel = lazy(() =>
  import("./TransportGroupSettingsPanel").then((module) => ({
    default: module.TransportGroupSettingsPanel,
  })),
);

export function TripSettingsPanel({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const profileQuery = useCurrentTravelerQuery();
  const tripName =
    profileQuery.data?.trips.find((trip) => trip.tripId === tripId)?.tripName ??
    "";
  const tripEndDate =
    profileQuery.data?.trips.find((trip) => trip.tripId === tripId)?.endsOn ??
    "";
  const mutation = useUpdateTripNameMutation(tripId);
  const [name, setName] = useState(tripName);
  const [endsOn, setEndsOn] = useState(tripEndDate);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(tripName);
    setEndsOn(tripEndDate);
  }, [tripEndDate, tripName]);

  async function saveTripName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ name: name.trim(), endsOn: endsOn || null });
      setMessage(t("theTripNameHasBeenUpdated"));
    } catch {
      setMessage(t("theTripNameCouldNotBeUpdated"));
    }
  }

  return (
    <section className="grid gap-4" aria-labelledby="trip-settings-title">
      <div className="grid gap-1">
        <h4 className="text-base font-bold" id="trip-settings-title">
          {t("tripInformation")}
        </h4>
        <p className="text-sm leading-relaxed text-content-muted">
          {t("manageTripAndOptionsDescription")}
        </p>
      </div>
      <Card
        as={Form}
        spacing="compact"
        arrangement="form"
        onSubmit={saveTripName}
      >
        <TextField
          className="grid min-w-0 gap-2"
          value={name}
          onChange={setName}
          isRequired
        >
          <Label className={textFieldStyles().label()}>{t("tripName")}</Label>
          <Input className={textFieldStyles().input()} maxLength={120} />
        </TextField>
        <ProfileDate
          label={t("tripEndDate")}
          value={endsOn}
          onChange={setEndsOn}
        />
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={mutation.isPending}
        >
          {t("save")}
        </Button>
        {message && (
          <p
            className={`${messageStyles()} col-span-full`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </Card>
      <TripRoomInventorySettings tripId={tripId} />
      <Suspense fallback={<p role="status">{t("loadingTransportGroups")}</p>}>
        <TransportGroupSettingsPanel tripId={tripId} />
      </Suspense>
    </section>
  );
}
