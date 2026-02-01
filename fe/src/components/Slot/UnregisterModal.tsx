import { memo, useEffect, useRef } from "react";
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
  const unregisterButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && unregisterButtonRef.current) {
      unregisterButtonRef.current.focus();
    }
  }, [isOpen]);

  return (
    <Modal onClose={onClose} isOpen={isOpen}>
      <h2 className="mx-2 mb-4 text-xl font-semibold">Confirm unregister</h2>
      <div className="flex gap-1 mx-1">
        <button
          ref={unregisterButtonRef}
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
