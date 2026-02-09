import { memo } from "react";
import { absoluteTimeFormatter } from "@/utils/formatters";
import type * as models from "../../models";
import { SlotBase } from "./SlotBase";

type SlotData = typeof models.SlotBase.infer;

interface SlotTakenProps {
  slot: SlotData;
}

function getTurnTimeDelta(realTurnTime: Date, expectedTime: Date) {
  const delayMs = realTurnTime.getTime() - expectedTime.getTime();
  const delayMinutes = Math.round(delayMs / (1000 * 60));

  if (delayMinutes > 0) {
    return { text: `${delayMinutes} min late`, className: "text-amber-600" };
  }
  if (delayMinutes < 0) {
    return {
      text: `${Math.abs(delayMinutes)} min early`,
      className: "text-green-800",
    };
  }
  return { text: "on time", className: "text-green-800" };
}

/**
 * Displays a slot that has been taken by another user.
 * Read-only, shows the registered client name.
 */
export const SlotTaken = memo(function SlotTaken({ slot }: SlotTakenProps) {
  const realTurnTime = slot.registered_real_turn_time;
  const isComplete = realTurnTime && realTurnTime < new Date();

  const delta = isComplete
    ? getTurnTimeDelta(realTurnTime, slot.starts_at)
    : null;

  return (
    <>
      <div className="flex-none">
        <div className="tabular-nums text-xl">
          {absoluteTimeFormatter.format(slot.starts_at)}
        </div>
        {isComplete ? (
          <div className="text-neutral-500 text-xs font-mono w-fit">
            COMPLETE
          </div>
        ) : (
          <div className="text-red-800 text-xs font-mono w-fit">NOT AVAIL.</div>
        )}
      </div>
      <div className="align-bottom">
        <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
          {slot.registered_client_name}
        </div>
        {isComplete ? (
          <div className={`text-xs ${delta?.className ?? "text-green-800"}`}>
            {delta?.text ?? "on time"}
          </div>
        ) : (
          <div className="text-xs">is currently registered</div>
        )}
      </div>
    </>
  );
});
