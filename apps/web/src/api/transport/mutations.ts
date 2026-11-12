import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { TransportGroupInput, TransportView } from "./transport.types";

export function useTransportMutations(tripId: string) {
  const client = useQueryClient();
  const base = `/api/trips/${encodeURIComponent(tripId)}`;
  const invalidate = () =>
    client.invalidateQueries({ queryKey: queryKeys.transport(tripId) });
  const createGroup = useMutation({
    mutationFn: (input: TransportGroupInput) =>
      apiRequest(`${base}/transport-groups`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
  const updateGroup = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransportGroupInput }) =>
      apiRequest(`${base}/transport-groups/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
  const deleteGroup = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`${base}/transport-groups/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
  const setParticipantTransport = useMutation({
    mutationFn: ({
      userId,
      choice,
      groupId,
    }: {
      userId: string;
      choice: "group" | "none" | "unconfirmed";
      groupId: string | null;
    }) =>
      apiRequest(
        `${base}/participants/${encodeURIComponent(userId)}/transport`,
        {
          method: "PUT",
          body: JSON.stringify({ choice, groupId }),
        },
      ),
    onSuccess: invalidate,
  });
  const saveCarpoolRole = useMutation({
    mutationFn: ({
      role,
      driverUserId,
    }: {
      role: "none" | "driver" | "passenger";
      driverUserId: string | null;
    }) =>
      apiRequest(`${base}/carpool-role`, {
        method: "PATCH",
        body: JSON.stringify({ role, driverUserId }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.transport(tripId) });
      await client.invalidateQueries({ queryKey: queryKeys.traveler(tripId) });
    },
  });
  const updateCache = (view: TransportView) =>
    client.setQueryData(queryKeys.transport(tripId), view);
  return {
    createGroup,
    updateGroup,
    deleteGroup,
    setParticipantTransport,
    saveCarpoolRole,
    updateCache,
  };
}
