import { memo } from "react";
import type { Registration } from "@/contexts/RegistrationContext";
import type * as models from "../../models";
import { SlotMine } from "./SlotMine";
import { SlotOpen, type SlotOpenVariant } from "./SlotOpen";
import { SlotTaken } from "./SlotTaken";

// Re-export for convenience
export { SlotBase } from "./SlotBase";
export { SlotMine } from "./SlotMine";
export { SlotOpen } from "./SlotOpen";
export { SlotTaken } from "./SlotTaken";

type SlotData = typeof models.SlotBase.infer;

export type SlotVariant = "open" | "open-muted" | "taken" | "mine";

/**
 * Determines the appropriate variant for a slot based on registration state.
 */
export function getSlotVariant(
  slot: SlotData,
  registeredSlotIds: number[],
): SlotVariant {
  if (registeredSlotIds.includes(slot.id)) {
    return "mine";
  }
  if (slot.registered_client_name) {
    return "taken";
  }
  if (registeredSlotIds.length > 0) {
    return "open-muted";
  }
  return "open";
}

interface SlotProps {
  slot: SlotData;
  variant: SlotVariant;
  onRegister?: (reg: Registration) => void;
  onUnregister?: () => void;
  isUnregistering?: boolean;
}

/**
 * Main Slot component that routes to the appropriate variant.
 * Use this component when you need dynamic variant selection.
 */
export const Slot = memo(function Slot({
  slot,
  variant,
  onRegister,
  onUnregister,
  isUnregistering = false,
}: SlotProps) {
  switch (variant) {
    case "mine":
      return (
        <SlotMine
          slot={slot}
          onUnregister={onUnregister ?? (() => {})}
          isUnregistering={isUnregistering}
        />
      );
    case "taken":
      return <SlotTaken slot={slot} />;
    case "open":
    case "open-muted":
      return (
        <SlotOpen
          slot={slot}
          variant={variant as SlotOpenVariant}
          onRegister={onRegister}
        />
      );
  }
});
