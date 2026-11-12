import { useRoomingQuery } from "@traveler/api/rooming/queries";
import { messageStyles } from "@traveler/components/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RoomConsentList } from "./RoomConsentList";
import { RoomManagementPanel } from "./RoomManagementPanel";
import { RoomOverview } from "./RoomOverview";
import { TravelerRooming } from "./TravelerRooming";

export function RoomingPanel({
  tripId,
  userId,
  view,
}: {
  tripId: string;
  userId: string;
  view: "personal" | "organizer";
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const isStaff = view === "organizer";
  const roomingQuery = useRoomingQuery(tripId, isStaff);

  if (roomingQuery.isPending) {
    return (
      <section className="grid gap-4" aria-busy="true">
        <p role="status">{t("loadingRoomAssignments")}</p>
      </section>
    );
  }
  if (roomingQuery.isError) {
    return (
      <section className="grid gap-4">
        <h3 className="text-lg font-bold">{t("rooms")}</h3>
        <p role="alert">{t("roomAssignmentsAreTemporarilyUnavailable")}</p>
      </section>
    );
  }

  const rooms = roomingQuery.data.roomData.rooms;
  const requests = roomingQuery.data.requestData.requests;
  const travelers = roomingQuery.data.travelerData?.travelers ?? [];
  const ownRoom = rooms.find((room) =>
    room.occupants.some((person) => person.userId === userId),
  );

  return (
    <section className="grid gap-5" aria-labelledby="rooming-title">
      <header className="grid gap-1">
        <h3 className="text-lg font-bold" id="rooming-title">
          {t("rooms")}
        </h3>
        <p className="text-sm leading-relaxed text-content-muted">
          {isStaff
            ? t("organizerRoomingOverviewDescription")
            : t("yourRoomAndPendingRequests")}
        </p>
      </header>
      {isStaff ? (
        <>
          <RoomManagementPanel
            tripId={tripId}
            rooms={rooms}
            travelers={travelers}
            onMessage={setMessage}
          />
          <RoomConsentList
            tripId={tripId}
            userId={userId}
            requests={requests}
            onMessage={setMessage}
          />
          <RoomOverview
            tripId={tripId}
            rooms={rooms}
            travelers={travelers}
            ownRoom={ownRoom}
            userId={userId}
            isStaff
            onMessage={setMessage}
          />
        </>
      ) : (
        <>
          <TravelerRooming
            tripId={tripId}
            rooms={rooms}
            ownRoom={ownRoom}
            userId={userId}
            onMessage={setMessage}
          />
          <RoomConsentList
            tripId={tripId}
            userId={userId}
            requests={requests}
            onMessage={setMessage}
            mode="status"
          />
        </>
      )}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
