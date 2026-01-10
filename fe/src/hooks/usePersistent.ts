import * as models from "../models";
import { useLocalStorage } from "@/hooks/localStorage";

const KNOWN_TOKENS_EXAMPLE: (typeof models.KnownToken.infer)[] = [
  { id: 1, slot_id: null, list_id: 25, secret: "toto" },
  { id: 2, slot_id: null, list_id: 26, secret: "tata" },
  { id: 3, slot_id: null, list_id: 27, secret: "riri" },
];

export function usePersistent() {
  return useLocalStorage(
    "persistent",
    models.PersistentStorage.fromRaw({
      known_tokens: KNOWN_TOKENS_EXAMPLE,
      known_lists: {},
      last_used_name: null,
    }),
    models.PersistentStorage.fromRaw,
  );
}
