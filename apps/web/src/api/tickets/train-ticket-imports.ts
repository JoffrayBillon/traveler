import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost, apiRequest } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";

export type ImportedTicketKind =
  | "named"
  | "transferable"
  | "collective"
  | "auxiliary"
  | "review";
export type ImportedTicketStatus = "ready" | "review" | "published" | "ignored";
export type ImportedTicketIssue =
  | "duplicateTicket"
  | "segmentMismatch"
  | "travelerUnavailable"
  | "unassigned"
  | "unrecognized"
  | "multipleTickets"
  | "collectiveUnconfirmed"
  | null;

export type TrainTicketImportItem = {
  id: string;
  pages: number[];
  kind: ImportedTicketKind;
  carrier: "inoui" | "lyria" | "ouigo" | "trenitalia" | "ter" | null;
  ticketNumber: string | null;
  reservation: string | null;
  serviceReference: string | null;
  carriage: string | null;
  seat: string | null;
  firstName: string | null;
  lastName: string | null;
  capacity: number | null;
  status: ImportedTicketStatus;
  issue: ImportedTicketIssue | string | null;
  userIds: string[];
};

export type TrainTicketImportSnapshot = {
  snapshot: string;
  coverage: {
    expected: number;
    published: number;
    ready: number;
    missing: Array<{ id: string; name: string }>;
  };
  travelers: Array<{ id: string; name: string }>;
  documents: Array<{
    id: string;
    name: string;
    items: TrainTicketImportItem[];
  }>;
};

export type UpdateTrainTicketImportItem = {
  kind: "named" | "transferable" | "collective" | "ignored" | "detected";
  userIds?: string[];
  ticketNumber?: string;
  carriage?: string;
  seat?: string;
  capacity?: number;
};

function importsPath(tripId: string, segmentId: string) {
  return `/api/trips/${encodeURIComponent(tripId)}/train-tickets/${encodeURIComponent(segmentId)}/imports`;
}

export function useTrainTicketImportsQuery(tripId: string, segmentId: string) {
  return useQuery({
    queryKey: queryKeys.trainTicketImports(tripId, segmentId),
    queryFn: ({ signal }) =>
      apiGet<TrainTicketImportSnapshot>(importsPath(tripId, segmentId), signal),
  });
}

function useRefreshAfterImport(tripId: string, segmentId: string) {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      queryKey: queryKeys.trainTicketImports(tripId, segmentId),
    });
}

export function useUploadTrainTicketImportMutation(
  tripId: string,
  segmentId: string,
) {
  const refresh = useRefreshAfterImport(tripId, segmentId);
  const path = importsPath(tripId, segmentId);
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return apiRequest<{ documentId: string; duplicate: boolean }>(
        `${path}/documents`,
        { method: "POST", body },
      );
    },
    onSuccess: refresh,
  });
}

export function useUpdateTrainTicketImportItemMutation(
  tripId: string,
  segmentId: string,
) {
  const refresh = useRefreshAfterImport(tripId, segmentId);
  const path = importsPath(tripId, segmentId);
  return useMutation({
    mutationFn: ({
      itemId,
      ...body
    }: UpdateTrainTicketImportItem & { itemId: string }) =>
      apiRequest(`${path}/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: refresh,
    onError: (error) => {
      if (error instanceof ApiError && error.code === "train_import_changed")
        return refresh();
    },
  });
}

export function useRemoveTrainTicketImportDocumentMutation(
  tripId: string,
  segmentId: string,
) {
  const client = useQueryClient();
  const path = importsPath(tripId, segmentId);
  return useMutation({
    mutationFn: ({
      documentId,
      confirmPublished,
    }: {
      documentId: string;
      confirmPublished: boolean;
    }) =>
      apiRequest(
        `${path}/documents/${encodeURIComponent(documentId)}${confirmPublished ? "?confirmPublished=true" : ""}`,
        { method: "DELETE" },
      ),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({
          queryKey: queryKeys.trainTicketImports(tripId, segmentId),
        }),
        client.invalidateQueries({
          queryKey: queryKeys.trainTickets(tripId, segmentId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.traveler(tripId) }),
      ]),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "train_import_conflict") {
        return client.invalidateQueries({
          queryKey: queryKeys.trainTicketImports(tripId, segmentId),
        });
      }
    },
  });
}

export function usePublishTrainTicketImportsMutation(
  tripId: string,
  segmentId: string,
) {
  const client = useQueryClient();
  const path = importsPath(tripId, segmentId);
  return useMutation({
    mutationFn: (snapshot: string) => apiPost(`${path}/publish`, { snapshot }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({
          queryKey: queryKeys.trainTicketImports(tripId, segmentId),
        }),
        client.invalidateQueries({
          queryKey: queryKeys.trainTickets(tripId, segmentId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.traveler(tripId) }),
      ]),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "train_import_changed") {
        return client.invalidateQueries({
          queryKey: queryKeys.trainTicketImports(tripId, segmentId),
        });
      }
    },
  });
}
