import { memo, useEffect, useState } from "react";
import { absoluteTimeFormatter } from "@/utils/formatters";
import type * as models from "../../models";
import { SlotBase } from "./SlotBase";
import { UnregisterModal } from "./UnregisterModal";
import { useUnregisterToken } from "@/hooks/useUnregisterToken";

type SlotData = typeof models.SlotBase.infer;

interface SlotMineProps {
  slot: SlotData;
  secret?: string;
}

/**
 * Displays a slot that belongs to the current user.
 * Clickable button that opens an unregister confirmation modal.
 */
export const SlotMine = memo(({ slot, secret }: SlotMineProps) => {
  const [aboutToUnregister, setAboutToUnregister] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const { mutate: unregister, isSuccess, reset } = useUnregisterToken();

  // TODO: figure out if this is acutally necessary
  useEffect(() => {
    if (isSuccess) {
      setIsUnregistering(false);
      reset();
    }
  }, [isSuccess, reset]);

  return (
    <button
      type="button"
      onClick={() => setAboutToUnregister(true)}
      disabled={aboutToUnregister || isUnregistering}
      className="group w-full text-left cursor-pointer disabled:cursor-wait"
    >
      <SlotBase>
        <div className="flex-none group-hover:hidden">
          <div className="tabular-nums text-xl">
            {absoluteTimeFormatter.format(slot.starts_at)}
          </div>
          <div className="text-green-800 text-xs font-mono w-fit">YOURS</div>
        </div>
        <div className="align-bottom group-hover:hidden">
          <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
            {slot.registered_client_name}
          </div>
          <div className="text-xs">
            <span className="font-semibold">this is your slot</span>
          </div>
        </div>
        <div className="hidden group-hover:flex w-full items-center justify-center text-neutral-600">
          {isUnregistering ? "unregistering..." : "click to unregister"}
        </div>
        {secret && (
          <UnregisterModal
            isOpen={aboutToUnregister}
            onClose={() => setAboutToUnregister(false)}
            onConfirm={() => {
              unregister(secret);
              setIsUnregistering(true);
            }}
            isUnregistering={isUnregistering}
          />
        )}
      </SlotBase>
    </button>
  );
});
