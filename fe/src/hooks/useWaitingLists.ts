import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type } from "arktype";
import { fetchWithETag, type WithETag } from "@/utils/fetchWithETag";
import * as models from "../models";

type WaitingListData = (typeof models.WaitingListRelated.infer)[];

export const LIST_QUERY_KEY = ["list"] as const;

export function useWaitingLists() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: LIST_QUERY_KEY,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    retry: 3,
    queryFn: async () => {
      const cached =
        queryClient.getQueryData<WithETag<WaitingListData>>(LIST_QUERY_KEY);
      const result = await fetchWithETag<WaitingListData>(
        "/api/list?open=true",
        cached,
      );

      // Skip validation if data unchanged (304)
      if (cached && result === cached) {
        return result;
      }

      // Validate and transform new data
      const parsed = models.WaitingListRelated.array()(result);
      if (parsed instanceof type.errors) {
        console.error(parsed);
        throw parsed;
      }
      for (const list of parsed) {
        models.matchSlotsToTokens(list.slots, list.tokens);
      }

      // Preserve ETag on validated data
      return Object.assign(parsed, { _etag: result._etag });
    },
  });
}
