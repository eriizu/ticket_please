import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (secret: string) => {
      const res = await fetch(`/api/list/${secret}`, {
        method: "DELETE",
      });
      if (res.status < 200 && res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
    },
    onError: (e, variables) => {
      console.error(`delete list failed for ${variables}`, e);
    },
  });
};
