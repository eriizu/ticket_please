import { createFileRoute } from "@tanstack/react-router";
import * as models from "../models";
import { useState } from "react";
import { usePruneTokens } from "@/hooks/usePruneTokens";
import { usePersistent } from "@/hooks/usePersistent";
import { useLocalStorage } from "@/hooks/localStorage";

export const Route = createFileRoute("/prune")({
  component: TokenManager,
});

function TokenManager() {
  const [persistent, setPersistent] = usePersistent();

  const pruneMutation = usePruneTokens(persistent, setPersistent);

  const handlePrune = async () => {
    await pruneMutation.mutateAsync();
    // Reload storage from localStorage after pruning
  };

  return (
    <button
      className="border m-1 p-1 rounded-md"
      type="button"
      onClick={handlePrune}
      disabled={pruneMutation.isPending}
    >
      {pruneMutation.isPending ? "Pruning..." : "Prune Invalid Tokens"}
    </button>
  );
}
