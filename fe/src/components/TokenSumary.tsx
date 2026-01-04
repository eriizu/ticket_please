import { usePruneTokens } from "@/hooks/usePruneTokens";
import { usePersistent } from "@/hooks/usePersistent";
import { useTokenValidation } from "@/hooks/useTokenValidation";

export function TokenSumary() {
  return (
    <div className="text-neutral-800">
      <TokenSumaryInner />
    </div>
  );
}

function TokenSumaryInner() {
  const [persistent, setPersistent] = usePersistent();
  const pruneMutation = usePruneTokens(persistent, setPersistent);
  const handlePrune = async () => {
    await pruneMutation.mutateAsync();
  };
  const { isLoading, invalidTokenIds, results } = useTokenValidation(
    persistent.known_tokens,
  );

  if (isLoading) {
    return <p>checking valid known tokens...</p>;
  }

  const total_count = results.filter((t) => t.isSuccess).length;
  const invalid_count = results.filter(
    (t) => t.isSuccess && !t.data.isValid,
  ).length;
  const allValid = invalid_count === 0;
  if (total_count === 0) {
    return "You have no waiting token on this browser.";
  }
  if (allValid) {
    return "All your waiting tokens are still valid ✓";
  }
  return (
    <>
      <span>
        {invalid_count} of your {total_count} token·s are no longer valid and
        can be pruned:
      </span>
      <button
        className="underline mx-1 hover:text-amber-600 "
        type="button"
        onClick={handlePrune}
        disabled={pruneMutation.isPending}
      >
        {pruneMutation.isPending ? "pruning..." : "click here to prune ♻"}
      </button>
    </>
  );
}
