// hooks/usePruneTokens.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage} from '@/hooks/localStorage';
import * as models from "../models";

export function usePruneTokens(storage: models.PersistentStorage, setStorage: (val: models.PersistentStorage) => void) {
  const queryClient = useQueryClient();
  // const [persistent, setPersistent] = useLocalStorage("persistent", new models.PersistentStorage({}));

  return useMutation({
    mutationFn: async () => {
      console.log("mutating with", storage.known_tokens);
      // Validate all tokens
      const validationPromises = storage.known_tokens.map(async (token) => {
        const res = await fetch(`/api/token/${token.secret}`);
        return {
          tokenId: token.id,
          isValid: res.status !== 404,
        };
      });

      const results = await Promise.all(validationPromises);
      const invalidIds = results
        .filter((r) => !r.isValid)
        .map((r) => r.tokenId);

      // Update storage
      storage.removeTokens(invalidIds);

      return invalidIds;
    },
    onSuccess: (invalidIds) => {
      invalidIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: ['token', id] });
      });

      // Save to localStorage
      storage.removeTokens(invalidIds);
      setStorage(storage)
    },
  });
}
