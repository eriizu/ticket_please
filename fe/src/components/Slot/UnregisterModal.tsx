import { memo } from "react";
import { Modal } from "../Modal";

interface UnregisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isUnregistering: boolean;
}

export const UnregisterModal = memo(function UnregisterModal({
  isOpen,
  onClose,
  onConfirm,
  isUnregistering,
}: UnregisterModalProps) {
  return (
    <Modal onClose={onClose} isOpen={isOpen}>
      <h2 className="mx-2 mb-4 text-xl font-semibold">Confirm unregister</h2>
      <div className="flex gap-1 mx-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onConfirm();
          }}
          disabled={isUnregistering}
          className="flex-1 btn-primary mt-3 py-1"
        >
          Unregister
        </button>
        <button
          onClick={onClose}
          type="button"
          disabled={isUnregistering}
          className="flex-1 btn-secondary mt-3 py-1"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
});
