import type { ReactNode } from "react";

interface SlotBaseProps {
  children: ReactNode;
}

/**
 * Base container for slot components.
 * Provides consistent styling for all slot variants.
 */
export function SlotBase({ children }: SlotBaseProps) {
  return <div className="border border-neutral-500 rounded-md">{children}</div>;
}
