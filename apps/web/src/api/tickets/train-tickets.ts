import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost, apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";

type TrainTicketPool = {
  documents: { id: string; originalName: string }[];
  seats: {
    id: string;
    label: string;
    assignedName: string | null;
    roomNumber: string | null;
    isNew: boolean;
  }[];
  snapshot: string;
  unassigned: number;
  hasChanges: boolean;
};

function poolPath(tripId: string, segmentId: string) {
  return `/api/trips/${encodeURIComponent(tripId)}/train-tickets/${encodeURIComponent(segmentId)}`;
}

export function useTrainTicketPoolQuery(tripId: string, segmentId: string) {
  return useQuery({
    queryKey: queryKeys.trainTickets(tripId, segmentId),
    queryFn: ({ signal }) =>
      apiGet<TrainTicketPool>(poolPath(tripId, segmentId), signal),
  });
}

export function useUploadTrainTicketMutation(
  tripId: string,
  segmentId: string,
) {
  const client = useQueryClient();
  const path = poolPath(tripId, segmentId);
  const queryKey = queryKeys.trainTickets(tripId, segmentId);
  return useMutation({
    mutationFn: ({ file, seats }: { file: File; seats: string }) => {
      const form = new FormData();
      form.set("file", file);
      form.set("seats", seats);
      return apiRequest(`${path}/documents`, { method: "POST", body: form });
    },
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
}

export function usePublishTrainTicketPoolMutation(
  tripId: string,
  segmentId: string,
) {
  const client = useQueryClient();
  const path = poolPath(tripId, segmentId);
  const queryKey = queryKeys.trainTickets(tripId, segmentId);
  return useMutation({
    mutationFn: (snapshot: string) => apiPost(`${path}/publish`, { snapshot }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: queryKeys.traveler(tripId) }),
      ]),
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code === "train_ticket_pool_changed"
      )
        return client.invalidateQueries({ queryKey });
    },
  });
}

export function useRemoveTrainTicketMutation(
  tripId: string,
  segmentId: string,
) {
  const client = useQueryClient();
  const path = poolPath(tripId, segmentId);
  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(`${path}/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({
          queryKey: queryKeys.trainTickets(tripId, segmentId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.traveler(tripId) }),
      ]),
  });
}
