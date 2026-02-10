import { useMutation, useQueryClient } from "@tanstack/react-query";

export type WaitingTokenField =
  | "client_name"
  | "est_turn_time"
  | "real_turn_time"
  | "slot_id";

interface UpdateTokenParams {
  listSecret: string;
  tokenId: number;
  realTurnTime?: Date;
  clearFields?: WaitingTokenField[];
}

export function useAdminUpdateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      listSecret,
      tokenId,
      realTurnTime,
      clearFields,
    }: UpdateTokenParams) => {
      const body: Record<string, unknown> = {};
      if (realTurnTime) {
        body.real_turn_time = realTurnTime.toISOString();
      }
      if (clearFields && clearFields.length > 0) {
        body.clear_fields = clearFields;
      }
      const res = await fetch(`/api/list/${listSecret}/token/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

interface DeleteTokenParams {
  listSecret: string;
  tokenId: number;
}

export function useAdminDeleteToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listSecret, tokenId }: DeleteTokenParams) => {
      const res = await fetch(`/api/list/${listSecret}/token/${tokenId}`, {
        method: "DELETE",
      });
      if (res.status < 200 || res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
  });
}
