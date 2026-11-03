import { useRoomingQuery } from "@traveler/api/rooming/queries";
import { useState } from "react";
import { RoomConsentList } from "./RoomConsentList";

export function RoomConsentAlert({
  tripId,
  userId,
}: {
  tripId: string;
  userId: string;
}) {
  const query = useRoomingQuery(tripId, false);
  const [message, setMessage] = useState("");

  if (!query.data) return null;

  return (
    <>
      <RoomConsentList
        tripId={tripId}
        userId={userId}
        requests={query.data.requestData.requests}
        onMessage={setMessage}
        mode="actionable"
      />
      {message && (
        <p
          className="text-sm text-content-muted"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </>
  );
}
