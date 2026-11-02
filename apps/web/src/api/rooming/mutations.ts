import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { RoomAssignmentPlan, RoomInventoryItem } from "./rooming.types";

type RoomMove = {
  userId: string;
  expectedRoomId: string | null;
  targetRoomId: string;
};

type CreateRoomRequest =
  | { targetRoomId: string; exchangeWithEmail: string }
  | { moves: RoomMove[] };

export function useRoomingMutations(tripId: string) {
  const queryClient = useQueryClient();
  const invalidateRooming = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.rooming(tripId) });
  const saveRoomInventory = useMutation({
    mutationFn: (inventory: RoomInventoryItem[]) =>
      apiRequest<{ inventory: RoomInventoryItem[] }>(
        `/api/trips/${encodeURIComponent(tripId)}/rooms/inventory`,
        { method: "PUT", body: JSON.stringify({ inventory }) },
      ),
    onSuccess: async () => {
      await Promise.all([
        invalidateRooming(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.roomInventory(tripId),
        }),
      ]);
    },
  });
  const base = `/api/trips/${encodeURIComponent(tripId)}`;

  const createRequest = useMutation({
    mutationFn: (input: CreateRoomRequest) =>
      apiPost(`${base}/room-requests`, input),
    onSuccess: invalidateRooming,
  });
  const respondToRequest = useMutation({
    mutationFn: ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }) =>
      apiPost<{ status?: string }>(
        `${base}/room-requests/${encodeURIComponent(requestId)}/consent`,
        { approve },
      ),
    onSuccess: invalidateRooming,
  });
  const generateRoomAssignments = useMutation({
    mutationFn: (snapshot: string) =>
      apiPost<{
        status: "applied";
        assigned: number;
        unassignedConfirmed: number;
        unconfirmed: number;
        inventoryCreated: boolean;
      }>(`${base}/rooms/generate`, { snapshot }),
    onSuccess: invalidateRooming,
  });
  const previewRoomAssignments = useMutation({
    mutationFn: () =>
      apiPost<RoomAssignmentPlan>(`${base}/rooms/plan-preview`, {}),
  });
  const moveTraveler = useMutation({
    mutationFn: ({
      roomId,
      userId,
      expectedRoomId,
    }: {
      roomId: string;
      userId: string;
      expectedRoomId: string | null;
    }) =>
      apiRequest(
        `${base}/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ expectedRoomId }),
        },
      ),
    onSuccess: invalidateRooming,
  });
  const setRoomLock = useMutation({
    mutationFn: ({ roomId, locked }: { roomId: string; locked: boolean }) =>
      apiRequest<{ locked: boolean }>(
        `${base}/rooms/${encodeURIComponent(roomId)}/lock`,
        {
          method: "PATCH",
          body: JSON.stringify({ locked }),
        },
      ),
    onSuccess: invalidateRooming,
  });
  const withdrawRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<{ status: "cancelled" | "expired" }>(
        `${base}/room-requests/${encodeURIComponent(requestId)}`,
        { method: "DELETE" },
      ),
    onSuccess: invalidateRooming,
  });

  return {
    createRequest,
    respondToRequest,
    saveRoomInventory,
    generateRoomAssignments,
    previewRoomAssignments,
    moveTraveler,
    setRoomLock,
    withdrawRequest,
  };
}
