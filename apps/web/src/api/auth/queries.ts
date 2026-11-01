import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "@traveler/api/client";
import { queryKeys } from "@traveler/api/query-keys";
import type { TravelerProfile } from "@traveler/types/profile";

export function useCurrentTravelerQuery() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await apiGet<TravelerProfile>("/api/me", signal);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status))
          return null;
        throw error;
      }
    },
  });
}
