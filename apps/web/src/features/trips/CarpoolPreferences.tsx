import { useTransportMutations } from "@traveler/api/transport/mutations";
import type { TransportView } from "@traveler/api/transport/transport.types";
import {
  Button,
  Card,
  listBoxStyles,
  messageStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import { useEffect, useState } from "react";
import {
  Form,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

type CarpoolRole = "none" | "driver" | "passenger";
type StoredCarpoolRole = NonNullable<TransportView["self"]>["carpoolRole"];

export function CarpoolPreferences({
  tripId,
  self,
  drivers,
}: {
  tripId: string;
  self: NonNullable<TransportView["self"]>;
  drivers: TransportView["drivers"];
}) {
  const { t } = useTranslation();
  const mutations = useTransportMutations(tripId);
  const initialRole = toEditableRole(self.carpoolRole);
  const [role, setRole] = useState<CarpoolRole | null>(initialRole);
  const [driverUserId, setDriverUserId] = useState(
    self.carpoolDriverUserId ?? "",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRole(toEditableRole(self.carpoolRole));
    setDriverUserId(self.carpoolDriverUserId ?? "");
  }, [self.carpoolDriverUserId, self.carpoolRole]);

  async function save() {
    if (!role || (role === "passenger" && !driverUserId)) return;
    try {
      await mutations.saveCarpoolRole.mutateAsync({
        role,
        driverUserId: role === "passenger" ? driverUserId : null,
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
        {t("noGroupTransport")}
      </h3>
      <p className="text-sm leading-relaxed text-content-muted">
        {t("chooseWhetherYouDriveOrNeedAPassengerSeat")}
      </p>
      <Form
        className="grid gap-3 sm:grid-cols-2 sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Select
          className="grid min-w-0 gap-2"
          selectedKey={role}
          onSelectionChange={(key) => {
            setRole(
              key === "none" || key === "driver" || key === "passenger"
                ? key
                : null,
            );
            if (key !== "passenger") setDriverUserId("");
          }}
          isDisabled={mutations.saveCarpoolRole.isPending}
          isRequired
        >
          <Label className={textFieldStyles().label()}>
            {t("carpoolRole")}
          </Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <Popover>
            <ListBox className={listBoxStyles().list()}>
              <ListBoxItem id="none" className={listBoxStyles().item()}>
                {t("notCarpooling")}
              </ListBoxItem>
              <ListBoxItem id="driver" className={listBoxStyles().item()}>
                {t("iWillDrive")}
              </ListBoxItem>
              <ListBoxItem id="passenger" className={listBoxStyles().item()}>
                {t("iNeedAPassengerSeat")}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        {role === "passenger" && (
          <Select
            className="grid min-w-0 gap-2"
            selectedKey={driverUserId || null}
            onSelectionChange={(key) => setDriverUserId(key ? String(key) : "")}
            isDisabled={
              mutations.saveCarpoolRole.isPending || drivers.length === 0
            }
            isRequired
          >
            <Label className={textFieldStyles().label()}>
              {t("chooseYourDriver")}
            </Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <Popover>
              <ListBox className={listBoxStyles().list()}>
                {drivers.map((driver) => (
                  <ListBoxItem
                    id={driver.userId}
                    key={driver.userId}
                    className={listBoxStyles().item()}
                  >
                    {driver.firstName} {driver.lastName} ·{" "}
                    {t("passengersCount", { count: driver.passengerCount })}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        )}
        <Button
          appearance="secondary"
          type="submit"
          isDisabled={
            !role ||
            (role === "passenger" && (!driverUserId || drivers.length === 0)) ||
            mutations.saveCarpoolRole.isPending
          }
        >
          {t("saveMyPreferences")}
        </Button>
      </Form>
      {role === "passenger" && drivers.length === 0 && (
        <p className="text-sm text-content-muted">
          {t("noDriversAvailableYet")}
        </p>
      )}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </Card>
  );
}

function toEditableRole(role: StoredCarpoolRole): CarpoolRole | null {
  return role === "undecided" ? null : role;
}
