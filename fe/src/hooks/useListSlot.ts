import { useQuery } from "@tanstack/react-query";
import { type } from "arktype";
import * as models from "../models";

export function useListSlot(id: number) {
  return useQuery({
    queryKey: ["list", "slot", id],
    refetchInterval: 1000,
    retry: 3,
    queryFn: async () => await (await fetch(`/api/slot/${id}`)).json(),
    select: (raw) => {
      const parsed = models.SlotRelated(raw);
      if (parsed instanceof type.errors) {
        console.error(parsed);
        throw parsed;
      }
      return parsed;
    },
  });
}
