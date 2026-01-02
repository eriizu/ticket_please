import * as models from "../models";
import { useLocalStorage } from "@/hooks/localStorage";

const KNOWN_TOKENS_EXAMPLE: (typeof models.KnownToken.infer)[] = [
  { id: 1, slot_id: null, list_id: 25, secret: "toto" },
  { id: 1, slot_id: null, list_id: 25, secret: "tata" },
  { id: 1, slot_id: null, list_id: 25, secret: "riri" },
  { id: 1, slot_id: null, list_id: 25, secret: "fifi" },
];


export function usePersistent() {
  return useLocalStorage(
    "persistent",
    models.PersistentStorage.fromRaw({
      known_tokens: KNOWN_TOKENS_EXAMPLE,
      last_used_name: null,
    }),
    models.PersistentStorage.fromRaw,
  );
}
