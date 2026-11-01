import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";
import type { StaffTraveler } from "../organizer/types";
import type { RoomRequestSummary, RoomSummary } from "./rooming.types";

export function useRoomingQuery(tripId: string, isStaff: boolean) {
  return useQuery({
    queryKey: queryKeys.rooming(tripId, isStaff),
    queryFn: async ({ signal }) => {
      const base = `/api/trips/${encodeURIComponent(tripId)}`;
      const [roomData, requestData, travelerData] = await Promise.all([
        apiGet<{ rooms: RoomSummary[] }>(`${base}/rooms`, signal),
        apiGet<{ requests: RoomRequestSummary[] }>(
          `${base}/room-requests`,
          signal,
        ),
        isStaff
          ? apiGet<{ travelers: StaffTraveler[] }>(`${base}/travelers`, signal)
          : Promise.resolve(null),
      ]);
      return { roomData, requestData, travelerData };
    },
  });
}
