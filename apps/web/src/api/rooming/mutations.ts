import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";

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
  const createRoom = useMutation({
    mutationFn: (input: { name: string; capacity: number }) =>
      apiPost(`${base}/rooms`, input),
    onSuccess: invalidateRooming,
  });
  const assignInitialRoom = useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: string }) =>
      apiPost(
        `${base}/rooms/${encodeURIComponent(roomId)}/initial-assignment`,
        { userId },
      ),
    onSuccess: invalidateRooming,
  });

  return { createRequest, respondToRequest, createRoom, assignInitialRoom };
}
