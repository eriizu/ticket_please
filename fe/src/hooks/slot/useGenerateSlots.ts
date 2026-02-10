import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as models from "@/models";
import { useLocalStorage } from "@/hooks/localStorage";
import { type } from "arktype";

const SlotGenerationBody = type({
  list_secret: "string",
  start: "Date",
  slot_duration_minutes: "number > 0",
  break_duration_minutes: "number >= 0",
  break_every_n_slots: "number > 0",
  slot_number: "number > 0",
});

export type SlotGenerationBody = typeof SlotGenerationBody.infer;
export { SlotGenerationBody };

export function useGenerateSlots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: typeof SlotGenerationBody.infer) => {
      const res = await fetch(`/api/list/${args.list_secret}/slots/gen`, {
        method: "POST",
        body: JSON.stringify(args),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.status < 200 && res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
    },
    onError: (e, variables) => {
      console.error(`registration failed for ${variables}`, e);
    },
  });
}
