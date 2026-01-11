import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as models from "../models";
import { LIST_QUERY_KEY } from "./useWaitingLists";

export function useUnregisterToken(
  persistent: models.PersistentStorage,
  setPersistent: (value: models.PersistentStorage) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (secret: string) => {
      const res = await fetch(`/api/token/${secret}`, { method: "DELETE" });
      if (res.status < 200 || res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
      return secret;
    },
    onSuccess: (secret) => {
      persistent.known_tokens = persistent.known_tokens.filter(
        (token) => token.secret !== secret,
      );
      setPersistent(persistent);
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
    onError: (error, secret) => {
      console.error(`unregistration failed for token ${secret}`, error);
    },
  });
}
