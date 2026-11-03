import type { RoomAssignmentPlan } from "@traveler/api/rooming/rooming.types";
import { Button, Card } from "@traveler/components/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function RoomPlanPreview({
  plan,
  isApplying,
  onApply,
  onCancel,
}: {
  plan: RoomAssignmentPlan;
  isApplying: boolean;
  onApply: (snapshot: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const assignmentsByRoom = useMemo(() => {
    const groups = new Map<
      string,
      { roomName: string; travelers: RoomAssignmentPlan["assignments"] }
    >();
    for (const assignment of plan.assignments) {
      const group = groups.get(assignment.roomId) ?? {
        roomName: assignment.roomName,
        travelers: [],
      };
      group.travelers.push(assignment);
      groups.set(assignment.roomId, group);
    }
    return [...groups.values()].sort((left, right) =>
      left.roomName.localeCompare(right.roomName, "fr"),
    );
  }, [plan.assignments]);

  return (
    <Card
      as="section"
      spacing="compact"
      arrangement="stack"
      aria-labelledby="room-plan-preview-title"
    >
      <div className="grid gap-1">
        <h5 className="font-semibold" id="room-plan-preview-title">
          {t("roomPlanPreview")}
        </h5>
        <p className="text-sm text-content-muted">
          {t("roomPlanPreviewSummary", {
            assigned: plan.assignments.length,
            rooms: assignmentsByRoom.length,
            unassigned: plan.unassignedConfirmed,
            unconfirmed: plan.unconfirmed,
          })}
        </p>
        {plan.roomsToCreate.length > 0 && (
          <p className="text-sm text-content-muted">
            {t("roomInventoryWillBeCreated", {
              rooms: plan.roomsToCreate.length,
            })}
          </p>
        )}
      </div>
      {assignmentsByRoom.length ? (
        <ul className="grid max-h-96 gap-2 overflow-y-auto rounded-card border border-border p-2">
          {assignmentsByRoom.map((group) => (
            <li
              key={group.roomName}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-card bg-surface-raised px-3 py-2 text-sm"
            >
              <strong>
                {t("roomAssignmentPreviewLine", { room: group.roomName })}
              </strong>
              <span className="text-content-muted">
                {group.travelers
                  .map(
                    (traveler) => `${traveler.firstName} ${traveler.lastName}`,
                  )
                  .join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-content-muted">
          {t("noEligibleTravelerForRoomPlan")}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button appearance="quiet" onPress={onCancel} isDisabled={isApplying}>
          {t("cancel")}
        </Button>
        <Button
          appearance="secondary"
          onPress={() => onApply(plan.snapshot)}
          isDisabled={
            isApplying ||
            (plan.assignments.length === 0 && plan.roomsToCreate.length === 0)
          }
        >
          {isApplying ? t("saving") : t("applyRoomPlan")}
        </Button>
      </div>
    </Card>
  );
}
