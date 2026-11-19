import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type {
  RoomHistoryEntry,
  RoomInventoryItem,
  RoomRequestSummary,
  RoomSummary,
} from "./rooming.types";

export function useRoomPlanQuery(tripId: string, organizerView: boolean) {
  return useQuery({
    queryKey: queryKeys.rooming(tripId, organizerView),
    queryFn: async ({ signal }) =>
      (
        await apiGet<{ rooms: RoomSummary[] }>(
          `/api/trips/${encodeURIComponent(tripId)}/rooms${organizerView ? "?view=organizer" : ""}`,
          signal,
        )
      ).rooms,
  });
}

export function useRoomRequestsQuery(tripId: string) {
  return useQuery({
    queryKey: queryKeys.roomRequests(tripId),
    queryFn: async ({ signal }) =>
      (
        await apiGet<{ requests: RoomRequestSummary[] }>(
          `/api/trips/${encodeURIComponent(tripId)}/room-requests`,
          signal,
        )
      ).requests,
  });
}

export function useRoomInventoryQuery(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.roomInventory(tripId),
    enabled,
    queryFn: ({ signal }) =>
      apiGet<{ inventory: RoomInventoryItem[] }>(
        `/api/trips/${encodeURIComponent(tripId)}/rooms/inventory`,
        signal,
      ),
  });
}

export function useRoomingHistoryQuery(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.roomingHistory(tripId),
    enabled,
    queryFn: ({ signal }) =>
      apiGet<{ history: RoomHistoryEntry[] }>(
        `/api/trips/${encodeURIComponent(tripId)}/rooming-history`,
        signal,
      ),
  });
}
