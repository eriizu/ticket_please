import { createFileRoute } from "@tanstack/react-router";
import { TokenSumary } from "@/components/TokenSumary";

export const Route = createFileRoute("/prune")({
  component: TokenManager,
});

function TokenManager() {
  return <TokenSumary />;
}
