import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type } from "arktype";
import { fetchWithETag, type WithETag } from "@/utils/fetchWithETag";
import * as models from "../models";

type SlotData = typeof models.SlotRelated.infer;

export function useListSlot(id: number) {
  const queryClient = useQueryClient();
  const queryKey = ["list", "slot", id] as const;

  return useQuery({
    queryKey,
    refetchInterval: 1000,
    retry: 3,
    queryFn: async () => {
      const cached = queryClient.getQueryData<WithETag<SlotData>>(queryKey);
      const result = await fetchWithETag<SlotData>(`/api/slot/${id}`, cached);

      // Skip validation if data unchanged (304)
      if (cached && result === cached) {
        return result;
      }

      // Validate new data
      const parsed = models.SlotRelated(result);
      if (parsed instanceof type.errors) {
        console.error(parsed);
        throw parsed;
      }

      // Preserve ETag on validated data
      return Object.assign(parsed, { _etag: result._etag });
    },
  });
}
