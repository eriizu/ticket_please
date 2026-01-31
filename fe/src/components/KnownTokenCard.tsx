import { memo, useState } from "react";
import { useKnownToken } from "@/hooks/useKnownToken";
import { useUnregisterToken } from "@/hooks/useUnregisterToken";
import { UnregisterModal } from "./Slot/UnregisterModal";
import { formatRelativeDateTime } from "@/utils/formatters";

interface KnownTokenCardProps {
  secret: string;
}

export const KnownTokenCard = memo(function KnownTokenCard({
  secret,
}: KnownTokenCardProps) {
  const { data, isPending, error } = useKnownToken(secret);
  const { mutate: unregister, isPending: isUnregistering } =
    useUnregisterToken();
  const [showUnregisterModal, setShowUnregisterModal] = useState(false);

  if (isPending) {
    return (
      <div className="p-3 border rounded-lg border-neutral-300 bg-neutral-50">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 border rounded-lg border-red-300 bg-red-50">
        <div className="text-red-700 text-sm">
          Token may have been deleted or expired
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-lg border-neutral-300 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-neutral-800 truncate">
            {data.list.name}
          </div>
          {data.client_name && (
            <div className="text-sm text-neutral-500">
              Registered as: {data.client_name}
            </div>
          )}
          <div className="text-sm text-neutral-600">
            {data.est_turn_time ? (
              <span>
                Expected turn: {formatRelativeDateTime(data.est_turn_time)}
              </span>
            ) : (
              <span className="text-neutral-400">No slot assigned yet</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowUnregisterModal(true)}
          disabled={isUnregistering}
          className="btn-secondary text-sm shrink-0"
        >
          {isUnregistering ? "..." : "Unregister"}
        </button>
      </div>
      <UnregisterModal
        isOpen={showUnregisterModal}
        onClose={() => setShowUnregisterModal(false)}
        onConfirm={() => unregister(secret)}
        isUnregistering={isUnregistering}
      />
    </div>
  );
});
