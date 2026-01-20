import { memo } from "react";
import type { Registration } from "@/contexts/RegistrationContext";
import { absoluteTimeFormatter } from "@/utils/formatters";
import type * as models from "../../models";
import { SlotBase } from "./SlotBase";

type SlotData = typeof models.SlotBase.infer;

export type SlotOpenVariant = "open" | "open-muted";

interface SlotOpenProps {
  slot: SlotData;
  variant: SlotOpenVariant;
  onRegister?: (reg: Registration) => void;
}

function getStatusDisplay(
  variant: SlotOpenVariant,
  isPast: boolean,
): { text: string; colorClass: string } {
  if (variant === "open") {
    return isPast
      ? { text: "PAST", colorClass: "text-red-800" }
      : { text: "AVAILABLE", colorClass: "text-green-800" };
  }
  // open-muted
  return isPast
    ? { text: "PAST", colorClass: "text-neutral-600" }
    : { text: "AVAILABLE", colorClass: "text-neutral-600" };
}

/**
 * Displays an open slot that can be registered for.
 * - "open" variant: fully available, shows register button
 * - "open-muted" variant: available but user already has a slot, muted styling
 */
export const SlotOpen = memo(function SlotOpen({
  slot,
  variant,
  onRegister,
}: SlotOpenProps) {
  const isPast = slot.starts_at <= new Date();
  const status = getStatusDisplay(variant, isPast);
  const canRegister = variant === "open" && !isPast && onRegister;

  return (
    <SlotBase>
      <div className="w-20 flex-none">
        <div className="tabular-nums text-xl">
          {absoluteTimeFormatter.format(slot.starts_at)}
        </div>
        <div className={`${status.colorClass} text-xs font-mono`}>
          {status.text}
        </div>
      </div>
      <div className="flex place-content-end w-full">
        {canRegister && (
          <button
            type="button"
            className='btn-secondary before:content-["+"] before:mr-1'
            onClick={() =>
              onRegister({ slot_id: slot.id, list_id: slot.list_id })
            }
          >
            register
          </button>
        )}
      </div>
    </SlotBase>
  );
});
