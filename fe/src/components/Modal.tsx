/** biome-ignore-all lint/a11y/noStaticElementInteractions: needed for a modal */
/** biome-ignore-all lint/a11y/useButtonType: needed for a modal */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: needed for a modal */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch bg-black/30 p-0 sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative flex h-full w-full max-h-[100dvh] max-w-none flex-col overflow-y-auto bg-white p-4 text-left shadow-lg sm:h-auto sm:max-w-md sm:rounded-xl"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
          paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-2xl"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
