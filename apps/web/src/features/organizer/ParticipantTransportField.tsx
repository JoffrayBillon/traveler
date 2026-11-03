import type { DetailsDraft } from "@traveler/api/participants/participant-form.types";
import type {
  TransportGroup,
  TransportView,
} from "@traveler/api/transport/transport.types";
import {
  Card,
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "@traveler/components/ui";
import {
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

export function ParticipantTransportField({
  details,
  groups,
  isLoading,
  onChange,
  drivers,
  participantId,
}: {
  details: DetailsDraft;
  groups: TransportGroup[];
  drivers: TransportView["drivers"];
  participantId: string;
  isLoading: boolean;
  onChange: <K extends keyof DetailsDraft>(
    key: K,
    value: DetailsDraft[K],
  ) => void;
}) {
  const { t } = useTranslation();
  const selectedKey =
    details.transportChoice === "group" && details.groupId
      ? `group:${details.groupId}`
      : (details.transportChoice ?? "unconfirmed");
  const availableDrivers = drivers.filter(
    (driver) => driver.userId !== participantId,
  );

  function selectTransport(value: string) {
    if (value.startsWith("group:")) {
      onChange("carpoolRole", "none");
      onChange("carpoolDriverUserId", null);
      onChange("transportChoice", "group");
      onChange("groupId", value.slice("group:".length));
      return;
    }
    const nextChoice = value === "none" ? "none" : "unconfirmed";
    if (nextChoice === "none" && details.transportChoice !== "none")
      onChange("carpoolRole", "undecided");
    if (nextChoice !== "none") onChange("carpoolRole", "none");
    onChange("carpoolDriverUserId", null);
    onChange("transportChoice", nextChoice);
    onChange("groupId", null);
  }

  return (
    <div className="grid gap-4">
      <Select
        className="grid min-w-0 gap-2"
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (key) selectTransport(String(key));
        }}
        isDisabled={isLoading}
      >
        <Label className={textFieldStyles().label()}>
          {t("transportAssignment")}
        </Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <Text className="text-sm text-content-subtle" slot="description">
          {t("profileTransportAssignmentDescription")}
        </Text>
        <Popover>
          <ListBox className={listBoxStyles().list()}>
            <ListBoxItem id="unconfirmed" className={listBoxStyles().item()}>
              {t("toBeConfirmed")}
            </ListBoxItem>
            <ListBoxItem id="none" className={listBoxStyles().item()}>
              {t("noGroupTransport")}
            </ListBoxItem>
            {groups.map((group) => (
              <ListBoxItem
                key={group.id}
                id={`group:${group.id}`}
                className={listBoxStyles().item()}
              >
                {group.name} · {group.sourceCity}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      {details.transportChoice === "none" && (
        <Card spacing="compact" arrangement="stack">
          <div className="grid gap-1">
            <h4 className="text-sm font-semibold">{t("carpoolSettings")}</h4>
            <p className="text-sm text-content-muted">
              {t("chooseWhetherYouDriveOrNeedAPassengerSeat")}
            </p>
          </div>
          <Select
            className="grid min-w-0 gap-2"
            selectedKey={details.carpoolRole ?? "undecided"}
            onSelectionChange={(key) => {
              const role = String(key);
              if (
                role !== "none" &&
                role !== "driver" &&
                role !== "passenger" &&
                role !== "undecided"
              )
                return;
              onChange("carpoolRole", role);
              if (role !== "passenger") onChange("carpoolDriverUserId", null);
            }}
            isRequired
          >
            <Label className={textFieldStyles().label()}>
              {t("participantCarpoolRole")}
            </Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <Popover>
              <ListBox className={listBoxStyles().list()}>
                <ListBoxItem id="undecided" className={listBoxStyles().item()}>
                  {t("toBeConfirmed")}
                </ListBoxItem>
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
          {details.carpoolRole === "passenger" && (
            <Select
              className="grid min-w-0 gap-2"
              selectedKey={details.carpoolDriverUserId}
              onSelectionChange={(key) =>
                onChange("carpoolDriverUserId", key ? String(key) : null)
              }
              isDisabled={availableDrivers.length === 0}
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
                  {availableDrivers.map((driver) => (
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
          {details.carpoolRole === "passenger" &&
            availableDrivers.length === 0 && (
              <p className="text-sm text-content-muted">
                {t("noDriversAvailableYet")}
              </p>
            )}
        </Card>
      )}
    </div>
  );
}
