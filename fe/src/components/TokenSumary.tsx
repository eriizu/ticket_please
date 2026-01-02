import { usePruneTokens } from "@/hooks/usePruneTokens";
import { usePersistent } from "@/hooks/usePersistent";
import { useTokenValidation } from "@/hooks/useTokenValidation";

export function TokenSumary() {
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
    return <div className="text-neutral-800">You have no waiting token on this browser.</div>;
  }
  if (allValid) {
    return <div className="text-neutral-800">All your waiting tokens are still valid ✓</div>;
  }
  return (
    <div className="text-neutral-900">
      <span>
        {invalid_count} of your {total_count} token·s are no longer valid and
        can be pruned:
      </span>
      <button
        className="border-b mx-1 hover:text-amber-600 "
        type="button"
        onClick={handlePrune}
        disabled={pruneMutation.isPending}
      >
        {pruneMutation.isPending ? "pruning..." : "click here to prune ♻"}
      </button>
    </div>
  );
}
