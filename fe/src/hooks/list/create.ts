import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type } from "arktype";
import * as models from "../../models";

const ListCreate = models.WaitingListBase.pick("name", "opens_at", "closes_at");
const WaitingListWithSecret = models.WaitingListBase.merge({
  secret: "string",
});

export class MissingListMasterError extends Error {
  constructor() {
    super("List master secret is required to create a waiting list");
    this.name = "MissingListMasterError";
  }
}

export function useCreateList(
  storage: models.PersistentStorage,
  setStorage: (val: models.PersistentStorage) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: typeof ListCreate.infer) => {
      if (!storage.list_master) {
        throw new MissingListMasterError();
      }
      const url = `/api/list?master=${encodeURIComponent(storage.list_master)}`;
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(args),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.status === 404) {
        throw new Error("Invalid list master secret", {
          cause: await res.text(),
        });
      }
      if (res.status < 200 || res.status > 299) {
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
