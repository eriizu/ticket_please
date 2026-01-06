import type * as models from "../models";
import type { Registration } from "./RegisterModal";

export type SlotVariant = "open" | "open-muted" | "taken" | "mine";

export function getSlotVariant(
  slot: typeof models.SlotBase.infer,
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

export function SlotBase(props: { children: React.ReactNode }) {
  return (
    <div className="border h-12 rounded-md p-1 flex items-center gap-3">
      {props.children}
    </div>
  );
}

const absoluteTimeFormatter = Intl.DateTimeFormat("en-IE", {
  timeStyle: "short",
});

function getStatusDisplay(
  variant: SlotVariant,
  startsAt: Date,
): { text: string; colorClass: string } {
  const isPast = startsAt <= new Date();

  switch (variant) {
    case "mine":
      return { text: "YOURS", colorClass: "text-green-800" };
    case "taken":
      return { text: "NOT AVAIL.", colorClass: "text-red-800" };
    case "open":
      return isPast
        ? { text: "PAST", colorClass: "text-red-800" }
        : { text: "AVAILABLE", colorClass: "text-green-800" };
    case "open-muted":
      return isPast
        ? { text: "PAST", colorClass: "text-neutral-600" }
        : { text: "AVAILABLE", colorClass: "text-neutral-600" };
  }
}

interface SlotProps {
  slot: typeof models.SlotBase.infer;
  variant: SlotVariant;
  onRegister?: (reg: Registration) => void;
}

export function Slot({ slot, variant, onRegister }: SlotProps) {
  const status = getStatusDisplay(variant, slot.starts_at);
  const isPast = slot.starts_at <= new Date();
  const canRegister = variant === "open" && !isPast && onRegister;

  // Taken and Mine variants show the registered client info
  if (variant === "taken" || variant === "mine") {
    const wrapper = variant === "taken" ? "text-neutral-700" : "";
    return (
      <div className={wrapper}>
        <SlotBase>
          <div className="flex-none">
            <div className="tabular-nums text-xl">
              {absoluteTimeFormatter.format(slot.starts_at)}
            </div>
            <div className={`${status.colorClass} text-xs font-mono w-fit`}>
              {status.text}
            </div>
          </div>
          <div className="align-bottom">
            <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
              {slot.registered_client_name}
            </div>
            <div className="text-xs">
              {variant === "mine" ? (
                <span className="font-semibold">this is your slot</span>
              ) : (
                "is currently registered"
              )}
            </div>
          </div>
        </SlotBase>
      </div>
    );
  }

  // Open and Open-muted variants
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
}
