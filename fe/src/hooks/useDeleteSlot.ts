import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteSlotParams {
  listSecret: string;
  slotId: number;
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listSecret, slotId }: DeleteSlotParams) => {
      const res = await fetch(`/api/list/${listSecret}/slots/${slotId}`, {
        method: "DELETE",
      });
      if (res.status < 200 || res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
    },
  });
}
