import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as models from "../models";
import { type } from "arktype";

const ListCreate = models.WaitingListBase.pick("name", "opens_at", "closes_at");
const WaitingListWithSecret = models.WaitingListBase.merge({
  secret: "string",
});

export function useCreateList(
  storage: models.PersistentStorage,
  setStorage: (val: models.PersistentStorage) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: typeof ListCreate.infer) => {
      const res = await fetch("/api/list", {
        method: "POST",
        body: JSON.stringify(args),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.status < 200 && res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
      const parsedBody = WaitingListWithSecret(await res.json());
      if (parsedBody instanceof type.errors) {
        console.error(parsedBody);
        throw new Error(`body parsing error: ${parsedBody.toString()}`, {
          cause: parsedBody,
        });
      }
      return parsedBody;
    },
    onSuccess: (res) => {
      storage.known_lists[res.id] = res.secret;
      setStorage(storage);
      queryClient.invalidateQueries({ queryKey: ["list"] });
    },
    onError: (e, variables) => {
      console.error(`create list for ${variables}`, e);
    },
  });
}
