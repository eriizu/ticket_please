import { useQuery } from "@tanstack/react-query";
import { type } from "arktype";
import * as models from "../models";

export const LIST_QUERY_KEY = ["list"] as const;

async function fetchOpenWaitingLists() {
  const response = await fetch("/api/list?open=true");
  if (response.status < 200 || response.status > 299) {
    throw new Error("request failed", { cause: await response.text() });
  }
  const raw = await response.json();
  const parsed = models.WaitingListRelated.array()(raw);
  if (parsed instanceof type.errors) {
    console.error(parsed);
    throw parsed;
  }
  parsed.forEach((list) => {
    models.matchSlotsToTokens(list.slots, list.tokens);
  });
  return parsed;
}

export function useWaitingLists() {
  return useQuery({
    queryKey: LIST_QUERY_KEY,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    retry: 3,
    queryFn: fetchOpenWaitingLists,
  });
}
