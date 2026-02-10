import { memo, useEffect, useRef } from "react";
import type * as models from "../../models";
import { absoluteTimeFormatter } from "@/utils/formatters";
import { Modal } from "../Modal";

type SlotData = typeof models.SlotBase.infer;

export type SlotConfirmAction = "unregister" | "delete";

interface SlotConfirmModalProps {
  action: SlotConfirmAction | null;
  slot: SlotData;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const SlotConfirmModal = memo(function SlotConfirmModal({
  action,
  slot,
  isLoading,
  onConfirm,
  onClose,
}: SlotConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (action !== null) {
      confirmRef.current?.focus();
    }
  }, [action]);

  return (
    <Modal isOpen={action !== null} onClose={onClose}>
      <h2 className="mx-2 mb-2 text-xl font-semibold">
        {action === "unregister" ? "Confirm unregister" : "Confirm delete"}
      </h2>
      <div className="mx-2 mb-4 text-sm text-neutral-700">
        <p>
          Slot at{" "}
          <span className="font-semibold tabular-nums">
            {absoluteTimeFormatter.format(slot.starts_at)}
          </span>
          {" \u2013 "}
          <span className="font-semibold tabular-nums">
            {absoluteTimeFormatter.format(slot.ends_at)}
          </span>
        </p>
        {action === "unregister" && slot.registered_client_name && (
          <p>
            Registered to{" "}
            <span className="font-semibold">{slot.registered_client_name}</span>
          </p>
        )}
      </div>
      <div className="flex gap-1 mx-1">
        <button
          ref={confirmRef}
          type="button"
          onClick={() => {
            onClose();
            onConfirm();
          }}
          disabled={isLoading}
          className="flex-1 btn-primary mt-3 py-1"
        >
          {action === "unregister" ? "Unregister" : "Delete"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 btn-secondary mt-3 py-1"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
});
