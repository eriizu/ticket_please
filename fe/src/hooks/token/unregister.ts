import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getPersistentFromLocalStorage, usePersistent } from "../usePersistent";

export function useUnregisterToken() {
  const [_, setPersistent] = usePersistent();

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
      // INFO: we are not using persistent as returned by the hook because nothing
      // here changes based on what it contains, we only need the setPersistent
      // call so that reactive dependants are updated when modify it.
      const persistent = getPersistentFromLocalStorage();
      if (persistent) {
        persistent.known_tokens = persistent.known_tokens.filter(
          (token) => token.secret !== secret,
        );
        setPersistent(persistent);
      }

      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
    onError: (error, secret) => {
      console.error(`unregistration failed for token ${secret}`, error);
    },
  });
}
