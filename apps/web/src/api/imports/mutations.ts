import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiResponse } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type {
  ImportCommitResponse,
  ImportPreviewResponse,
} from "./import.types";

export function usePreviewParticipantImportMutation(tripId: string) {
  return useMutation({
    mutationFn: (form: FormData) =>
      apiRequest<ImportPreviewResponse>(
        `/api/trips/${encodeURIComponent(tripId)}/imports/preview`,
        { method: "POST", body: form },
      ),
    retry: false,
  });
}

export function useCommitParticipantImportMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      apiRequest<ImportCommitResponse>(
        `/api/trips/${encodeURIComponent(tripId)}/imports/commit`,
        { method: "POST", body: form },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rooming(tripId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.participantDirectory(tripId),
        }),
      ]);
    },
  });
}

export function useAgencySpreadsheetMutation(tripId: string) {
  return useMutation({
    mutationFn: (form: FormData) =>
      apiResponse(
        `/api/trips/${encodeURIComponent(tripId)}/rooms/agency-export`,
        { method: "POST", body: form },
      ),
    retry: false,
  });
}
