import { useQueries } from '@tanstack/react-query';
import type * as models from "../models";

export function useTokenValidation(tokens: (typeof models.KnownToken.infer)[]) {
  const results = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ['list', 'token-validation', token.id, token.secret],
      queryFn: async () => {
        const res = await fetch(`/api/token/${token.secret}`);
        return {
          tokenId: token.id,
          isValid: res.status !== 404,
        };
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const invalidTokenIds = results
    .filter((r) => r.data?.isValid === false)
    // biome-ignore lint/style/noNonNullAssertion: the value is checked in the filter
    .map((r) => r.data!.tokenId);

  return { isLoading, invalidTokenIds, results };
}
