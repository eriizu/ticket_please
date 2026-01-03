import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as models from "../models";
import { useLocalStorage } from "@/hooks/localStorage";
import { type } from "arktype";

const RegistrationResponse = models.WaitingTokenBase.merge({
  secret: "string",
  slot: models.SlotBase.or("null"),
  list: models.WaitingListBase,
});

export function useRegisterOnList(
  registration: { list_id: number; slot_id?: number },
  storage: models.PersistentStorage,
  setStorage: (val: models.PersistentStorage) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (client_name: string) => {
      const res = await fetch(`/api/list/${registration.list_id}/reg`, {
        method: "POST",
        body: JSON.stringify({
          client_name: client_name,
          slot_id: registration.slot_id,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.status < 200 && res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
      const parsedBody = RegistrationResponse(await res.json());
      if (parsedBody instanceof type.errors) {
        console.error(parsedBody);
        throw new Error(`body parsing error: ${parsedBody.toString()}`, {
          cause: parsedBody,
        });
      }
      return parsedBody;
    },
    onSuccess: (res) => {
      storage.known_tokens.push({
        secret: res.secret,
        list_id: res.list_id,
        id: res.id,
        slot_id: res.slot_id,
      });
      storage.last_used_name = res.client_name;
      setStorage(storage);
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
    onError: (e, variables) => {
      console.error(`registration failed for ${variables}`, e);
    },
  });
}
