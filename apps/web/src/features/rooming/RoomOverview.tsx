import type { RoomSummary } from "@traveler/api/rooming/rooming.types";
import { Card } from "@traveler/components/ui";
import { useTranslation } from "react-i18next";

export function RoomOverview({
  rooms,
  ownRoom,
  userId,
  isStaff,
}: {
  rooms: RoomSummary[];
  ownRoom: RoomSummary | undefined;
  userId: string;
  isStaff: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {ownRoom ? (
        <Card as="article" spacing="compact" arrangement="stack">
          <div className="grid gap-2">
            <span className="text-xs text-content-subtle">{t("yourRoom")}</span>
            <strong className="text-lg">{ownRoom.name}</strong>
          </div>
          <span className="inline-block rounded-full border border-border px-3 py-2 text-xs font-semibold text-content-muted">
            {t("occupiedCapacityBeds", {
              occupied: ownRoom.occupiedCount,
              capacity: ownRoom.capacity,
            })}
          </span>
          <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
            {ownRoom.occupants.map((person) => (
              <li key={person.userId}>
                {person.firstName} {person.lastName}
                {person.userId === userId ? ` · ${t("you")}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-content-muted">
          {t("youHaveNotBeenAssignedARoomYet")}
        </p>
      )}
      {isStaff && (
        <div className="grid gap-3">
          <h4 className="text-base font-bold">{t("currentRoomAssignments")}</h4>
          {rooms.map((room) => (
            <Card
              as="article"
              spacing="compact"
              arrangement="stack"
              key={room.id}
            >
              <div className="grid gap-2">
                <span className="text-xs text-content-subtle">
                  {t("occupiedCapacityBeds", {
                    occupied: room.occupiedCount,
                    capacity: room.capacity,
                  })}
                  {room.genderPolicy === "mixed"
                    ? ` · ${t("approvedMixedRoom")}`
                    : ""}
                </span>
                <strong className="text-lg">{room.name}</strong>
              </div>
              {room.occupants.length ? (
                <ul className="list-inside list-disc space-y-1 leading-relaxed text-content-muted">
                  {room.occupants.map((person) => (
                    <li key={person.userId}>
                      {person.firstName} {person.lastName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-content-subtle">{t("emptyRoom")}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
