import * as models from "../models";
import { useLocalStorage } from "@/hooks/localStorage";

export function usePersistent() {
  return useLocalStorage(
    "persistent",
    models.PersistentStorage.fromRaw({
      known_tokens: [],
      known_lists: {},
      last_used_name: null,
    }),
    models.PersistentStorage.fromRaw,
  );
}
