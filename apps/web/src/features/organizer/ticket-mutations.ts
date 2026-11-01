import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../shared/api/client";

export function useUploadTravelerTicketMutation(tripId: string) {
  return useMutation({
    mutationFn: async (input: {
      travelerId: string;
      kind: string;
      file: File;
    }) => {
      const form = new FormData();
      form.set("file", input.file);
      form.set("kind", input.kind);
      return apiRequest(
        `/api/trips/${encodeURIComponent(tripId)}/travelers/${encodeURIComponent(input.travelerId)}/tickets`,
        { method: "POST", body: form },
      );
    },
  });
}
