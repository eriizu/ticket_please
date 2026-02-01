import { useQuery } from "@tanstack/react-query";
import { type } from "arktype";
import * as models from "../models";

type TokenData = typeof models.WaitingTokenWithSecret.infer;

export function useKnownToken(secret: string) {
  return useQuery({
    queryKey: ["token", secret] as const,
    refetchInterval: 10000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/token/${secret}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch token: ${res.status}`);
      }
      const data = await res.json();
      const parsed = models.WaitingTokenWithSecret(data);
      if (parsed instanceof type.errors) {
        console.error(parsed);
        throw parsed;
      }
      return parsed as TokenData;
    },
  });
}
