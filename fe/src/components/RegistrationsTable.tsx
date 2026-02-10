import { memo, useMemo } from "react";
import {
  useAdminDeleteToken,
  useAdminUpdateToken,
} from "@/hooks/token/upadate_as_admin";
import { absoluteTimeFormatter } from "@/utils/formatters";
import type * as models from "../models";

type WaitingToken = typeof models.WaitingTokenBase.infer;

interface RegistrationsTableProps {
  tokens: WaitingToken[];
  listSecret: string;
}

export const RegistrationsTable = memo(function RegistrationsTable({
  tokens,
  listSecret,
}: RegistrationsTableProps) {
  const sortedTokens = useMemo(
    () => [...tokens].sort((a, b) => a.id - b.id),
    [tokens],
  );

  if (sortedTokens.length === 0) {
    return (
      <div className="text-neutral-500 text-sm py-2">No registrations yet</div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-2 py-1 text-sm font-medium text-neutral-600 border-b border-neutral-200">
        <div className="w-16">ID</div>
        <div className="flex-1 min-w-0">Name</div>
        <div className="w-16">Slot</div>
        <div className="w-40">Turn Time</div>
        <div className="w-56">Actions</div>
      </div>
      {sortedTokens.map((token) => (
        <TokenRow key={token.id} token={token} listSecret={listSecret} />
      ))}
    </div>
  );
});

interface TokenRowProps {
  token: WaitingToken;
  listSecret: string;
}

const TokenRow = memo(function TokenRow({ token, listSecret }: TokenRowProps) {
  const { mutate: updateToken, isPending: isUpdating } = useAdminUpdateToken();
  const { mutate: deleteToken, isPending: isDeleting } = useAdminDeleteToken();

  const handleMarkOnTime = () => {
    if (!token.est_turn_time) return;
    updateToken({
      listSecret,
      tokenId: token.id,
      realTurnTime: token.est_turn_time,
    });
  };

  const handleMarkNow = () => {
    updateToken({
      listSecret,
      tokenId: token.id,
      realTurnTime: new Date(),
    });
  };

  const handleClear = () => {
    updateToken({
      listSecret,
      tokenId: token.id,
      clearFields: ["real_turn_time"],
    });
  };

  const handleUnregister = () => {
    deleteToken({ listSecret, tokenId: token.id });
  };

  const isPending = isUpdating || isDeleting;

  return (
    <div className="flex items-center gap-3 px-2 py-1.5 border rounded-md border-neutral-200 hover:bg-neutral-50">
      <div className="w-16 text-neutral-600 text-sm">#{token.id}</div>
      <div className="flex-1 min-w-0 text-neutral-800 truncate">
        {token.client_name || <span className="text-neutral-400">No name</span>}
      </div>
      <div className="w-16 text-sm">
        {token.slot_id != null ? (
          <span className="text-green-600">Yes</span>
        ) : (
          <span className="text-neutral-400">No</span>
        )}
      </div>
      <div className="w-40 text-sm">
        <TurnTimeDisplay token={token} />
      </div>
      <div className="w-56 flex gap-1">
        <button
          type="button"
          className="btn-secondary text-xs px-2 py-1"
          onClick={handleMarkOnTime}
          disabled={isPending || !token.est_turn_time || !!token.real_turn_time}
          title={!token.est_turn_time ? "No expected time set" : undefined}
        >
          on time
        </button>
        <button
          type="button"
          className="btn-secondary text-xs px-2 py-1"
          onClick={handleMarkNow}
          disabled={isPending || !!token.real_turn_time}
        >
          now
        </button>
        <button
          type="button"
          className="btn-secondary text-xs px-2 py-1"
          onClick={handleClear}
          disabled={isPending || !token.real_turn_time}
        >
          clear
        </button>
        <button
          type="button"
          className="btn-secondary text-xs px-2 py-1 text-red-600"
          onClick={handleUnregister}
          disabled={isPending}
        >
          unreg
        </button>
      </div>
    </div>
  );
});

interface TurnTimeDisplayProps {
  token: WaitingToken;
}

const TurnTimeDisplay = memo(function TurnTimeDisplay({
  token,
}: TurnTimeDisplayProps) {
  const { real_turn_time, est_turn_time } = token;

  if (real_turn_time) {
    const time = absoluteTimeFormatter.format(real_turn_time);

    if (est_turn_time) {
      const delayMs = real_turn_time.getTime() - est_turn_time.getTime();
      const delayMinutes = Math.round(delayMs / (1000 * 60));

      if (delayMinutes > 0) {
        return (
          <span className="text-neutral-800">
            {time}{" "}
            <span className="text-amber-600">({delayMinutes} min late)</span>
          </span>
        );
      }
      if (delayMinutes < 0) {
        return (
          <span className="text-neutral-800">
            {time}{" "}
            <span className="text-green-600">
              ({Math.abs(delayMinutes)} min early)
            </span>
          </span>
        );
      }
      return (
        <span className="text-neutral-800">
          {time} <span className="text-green-600">(on time)</span>
        </span>
      );
    }

    return <span className="text-neutral-800">{time}</span>;
  }

  if (est_turn_time) {
    return (
      <span className="text-neutral-600">
        ~{absoluteTimeFormatter.format(est_turn_time)}{" "}
        <span className="text-neutral-400">(expected)</span>
      </span>
    );
  }

  return <span className="text-neutral-400">No time assigned</span>;
});
