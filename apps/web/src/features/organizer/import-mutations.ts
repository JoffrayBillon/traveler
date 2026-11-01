import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiResponse } from "../../shared/api/client";
import { queryKeys } from "../../shared/query/query-keys";
import type { TravelerProfile } from "../../types/profile";
import type { TravelerTripData } from "../trips/traveler-trip.types";
import type {
  ImportCommitResponse,
  ImportPreviewResponse,
} from "./import-types";

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

export function useUpdateTripNameMutation(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiRequest(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (_result, name) => {
      queryClient.setQueryData<TravelerTripData>(
        queryKeys.traveler(tripId),
        (current) =>
          current ? { ...current, trip: { ...current.trip, name } } : current,
      );
      queryClient.setQueryData<TravelerProfile | null>(
        queryKeys.me,
        (current) =>
          current
            ? {
                ...current,
                trips: current.trips.map((trip) =>
                  trip.tripId === tripId ? { ...trip, tripName: name } : trip,
                ),
              }
            : current,
      );
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
