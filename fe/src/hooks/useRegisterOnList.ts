import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as models from "../models";
import { useLocalStorage } from "@/hooks/localStorage";
import { type } from "arktype";

const RegistrationResponse = models.WaitingTokenBase.merge({
  secret: "string",
  slot: models.SlotBase,
  list: models.WaitingListBase,
});

export function useRegisterOnList(
  registration: { list_id: number; client_name: string; slot_id?: number },
  storage: models.PersistentStorage,
  setStorage: (val: models.PersistentStorage) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/list/${registration.list_id}/reg`, {
        method: "POST",
        body: JSON.stringify({
          client_name: registration.client_name,
          slot_id: registration.slot_id,
        }),
      });
      if (res.status < 200 && res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
      const parsedBody = RegistrationResponse(await res.json());
      if (parsedBody instanceof type.errors) {
        throw new Error("body parsing error", {
          cause: parsedBody.toString(),
        });
      }
      return parsedBody;
    },
    onSuccess: (res) => {
      storage.known_tokens.push({secret: res.secret, list_id: res.list_id, id: res.id, slot_id: res.slot_id});
      storage.last_used_name = res.client_name;
      setStorage(storage);
      queryClient.invalidateQueries({queryKey: ["list"]});
    },
  });
}
