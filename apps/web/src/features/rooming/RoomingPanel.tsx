import { useParticipantDirectoryQuery } from "@traveler/api/participants/queries";
import {
  useRoomPlanQuery,
  useRoomRequestsQuery,
} from "@traveler/api/rooming/queries";
import { messageStyles } from "@traveler/components/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RoomConsentList } from "./RoomConsentList";
import { RoomManagementPanel } from "./RoomManagementPanel";
import { RoomOverview } from "./RoomOverview";
import { RoomRefreshButton } from "./RoomRefreshButton";
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
  const [assignmentTravelerId, setAssignmentTravelerId] = useState<
    string | null | undefined
  >(undefined);
  const isStaff = view === "organizer";
  const plan = useRoomPlanQuery(tripId, isStaff);
  const requests = useRoomRequestsQuery(tripId);
  const directory = useParticipantDirectoryQuery(tripId, isStaff);
  const rooms = plan.data ?? [];
  const travelers = directory.data ?? [];
  const ownRoom = rooms.find((room) =>
    room.occupants.some((person) => person.userId === userId),
  );

  async function refresh() {
    setMessage("");
    await Promise.all([
      plan.refetch(),
      requests.refetch(),
      ...(isStaff ? [directory.refetch()] : []),
    ]);
  }

  const requestList = requests.data && (
    <RoomConsentList
      tripId={tripId}
      userId={userId}
      requests={requests.data}
      onMessage={setMessage}
      mode={isStaff ? "all" : "status"}
    />
  );

  return (
    <section className="grid gap-5" aria-labelledby="rooming-title">
      <header className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="text-lg font-bold" id="rooming-title">
            {t("rooms")}
          </h3>
          <p className="text-sm leading-relaxed text-content-muted">
            {isStaff
              ? t("organizerRoomingOverviewDescription")
              : t("yourRoomAndPendingRequests")}
          </p>
        </div>
        <RoomRefreshButton
          lastUpdatedAt={plan.dataUpdatedAt}
          isRefreshing={
            plan.isFetching ||
            requests.isFetching ||
            (isStaff && directory.isFetching)
          }
          onRefresh={() => void refresh()}
        />
      </header>
      {plan.isLoadingError || (isStaff && directory.isLoadingError) ? (
        <p role="alert">{t("roomAssignmentsAreTemporarilyUnavailable")}</p>
      ) : plan.isPending || (isStaff && directory.isPending) ? (
        <p role="status">{t("loadingRoomAssignments")}</p>
      ) : isStaff ? (
        <>
          <RoomManagementPanel
            tripId={tripId}
            rooms={rooms}
            travelers={travelers}
            travelerId={assignmentTravelerId}
            onTravelerChange={setAssignmentTravelerId}
            onMessage={setMessage}
          />
          {requestList}
          <RoomOverview
            tripId={tripId}
            rooms={rooms}
            travelers={travelers}
            ownRoom={ownRoom}
            userId={userId}
            isStaff
            onSelectTraveler={setAssignmentTravelerId}
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
          {requestList}
        </>
      )}
      {(plan.isRefetchError || (isStaff && directory.isRefetchError)) && (
        <p role="alert">{t("roomPlanRefreshFailed")}</p>
      )}
      {requests.isError && <p role="alert">{t("roomRequestsUnavailable")}</p>}
      {message && (
        <p className={messageStyles()} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
