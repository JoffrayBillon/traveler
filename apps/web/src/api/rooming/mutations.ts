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
  const invalidatePlan = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.rooming(tripId) });
  async function invalidateRequests() {
    const queryKey = queryKeys.roomRequests(tripId);
    await queryClient.cancelQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey });
  }
  const invalidateHistory = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.roomingHistory(tripId),
    });
  const invalidateTrainTickets = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.trainTickets(tripId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.traveler(tripId) }),
    ]);

  function refreshAssignments() {
    void invalidateRequests();
    void invalidateHistory();
    return Promise.all([invalidatePlan(), invalidateTrainTickets()]);
  }

  function refreshRequest({ status }: { status: string }) {
    if (status === "applied") {
      return Promise.all([
        invalidateRequests(),
        invalidatePlan(),
        invalidateHistory(),
        invalidateTrainTickets(),
      ]);
    }
    if (status === "stale")
      return Promise.all([invalidatePlan(), invalidateRequests()]);
    return invalidateRequests();
  }
  const saveRoomInventory = useMutation({
    mutationFn: (inventory: RoomInventoryItem[]) =>
      apiRequest<{
        inventory: RoomInventoryItem[];
        added: number;
        removed: number;
      }>(`/api/trips/${encodeURIComponent(tripId)}/rooms/inventory`, {
        method: "PUT",
        body: JSON.stringify({ inventory }),
      }),
    onSuccess: async ({ removed }) => {
      if (removed) void invalidateRequests();
      await Promise.all([
        invalidatePlan(),
        removed ? invalidateTrainTickets() : undefined,
        queryClient.invalidateQueries({
          queryKey: queryKeys.roomInventory(tripId),
        }),
      ]);
    },
  });
  const base = `/api/trips/${encodeURIComponent(tripId)}`;

  const createRequest = useMutation({
    mutationFn: (input: CreateRoomRequest) =>
      apiPost<{ request: { status: "pending" | "applied" } }>(
        `${base}/room-requests`,
        input,
      ),
    onSuccess: ({ request }) => refreshRequest(request),
  });
  const respondToRequest = useMutation({
    mutationFn: ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }) =>
      apiPost<{ status: string }>(
        `${base}/room-requests/${encodeURIComponent(requestId)}/consent`,
        { approve },
      ),
    onSuccess: refreshRequest,
  });
  const generateRoomAssignments = useMutation({
    mutationFn: (snapshot: string) =>
      apiPost<{
        status: "applied";
        assigned: number;
        unassignedEligible: number;
        missingGender: number;
        inventoryCreated: boolean;
      }>(`${base}/rooms/generate`, { snapshot }),
    onSuccess: async ({ inventoryCreated }) => {
      if (inventoryCreated) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.roomInventory(tripId),
        });
      }
      await refreshAssignments();
    },
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
      exchangeWithUserId,
    }: {
      roomId: string;
      userId: string;
      expectedRoomId: string | null;
      exchangeWithUserId?: string;
    }) =>
      apiRequest(
        `${base}/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ expectedRoomId, exchangeWithUserId }),
        },
      ),
    onSuccess: refreshAssignments,
  });
  const unassignTraveler = useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: string }) =>
      apiRequest(
        `${base}/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    onSuccess: refreshAssignments,
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
    onSuccess: ({ locked }) => {
      if (locked) void invalidateRequests();
      return invalidatePlan();
    },
  });
  const withdrawRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<{ status: "cancelled" | "expired" }>(
        `${base}/room-requests/${encodeURIComponent(requestId)}`,
        { method: "DELETE" },
      ),
    onSuccess: invalidateRequests,
  });

  return {
    createRequest,
    respondToRequest,
    saveRoomInventory,
    generateRoomAssignments,
    previewRoomAssignments,
    moveTraveler,
    unassignTraveler,
    setRoomLock,
    withdrawRequest,
  };
}
