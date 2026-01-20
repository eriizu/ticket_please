import { memo } from "react";
import { absoluteTimeFormatter } from "@/utils/formatters";
import type * as models from "../../models";
import { SlotBase } from "./SlotBase";

type SlotData = typeof models.SlotBase.infer;

interface SlotTakenProps {
  slot: SlotData;
}

/**
 * Displays a slot that has been taken by another user.
 * Read-only, shows the registered client name.
 */
export const SlotTaken = memo(function SlotTaken({ slot }: SlotTakenProps) {
  return (
    <div className="text-neutral-700">
      <SlotBase>
        <div className="flex-none">
          <div className="tabular-nums text-xl">
            {absoluteTimeFormatter.format(slot.starts_at)}
          </div>
          <div className="text-red-800 text-xs font-mono w-fit">NOT AVAIL.</div>
        </div>
        <div className="align-bottom">
          <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
            {slot.registered_client_name}
          </div>
          <div className="text-xs">is currently registered</div>
        </div>
      </SlotBase>
    </div>
  );
});
