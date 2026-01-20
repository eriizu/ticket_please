import type { ReactNode } from "react";

interface SlotBaseProps {
  children: ReactNode;
}

/**
 * Base container for slot components.
 * Provides consistent styling for all slot variants.
 */
export function SlotBase({ children }: SlotBaseProps) {
  return (
    <div className="border h-12 rounded-md p-1 flex items-center gap-3">
      {children}
    </div>
  );
}
