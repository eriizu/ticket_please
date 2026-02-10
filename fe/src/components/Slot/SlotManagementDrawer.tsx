import { memo, useEffect, useId, useRef, useState } from "react";
import type * as models from "../../models";
import { useDeleteSlot } from "@/hooks/slot/useDeleteSlot";
import { useAdminUpdateToken } from "@/hooks/token/upadate_as_admin";
import { Modal } from "../Modal";
import { SlotConfirmModal, type SlotConfirmAction } from "./SlotConfirmModal";

type SlotData = typeof models.SlotBase.infer;

interface SlotManagementDrawerProps {
  slot: SlotData;
  listSecret: string;
}

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface ChooseTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (time: Date) => void;
  defaultTime?: Date;
  isLoading?: boolean;
}

const ChooseTimeModal = memo(function ChooseTimeModal({
  isOpen,
  onClose,
  onSubmit,
  defaultTime,
  isLoading,
}: ChooseTimeModalProps) {
  const [time, setTime] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (isOpen) {
      setTime(defaultTime ? formatDateTimeLocal(defaultTime) : "");
      inputRef.current?.focus();
    }
  }, [isOpen, defaultTime]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (time) {
      onSubmit(new Date(time));
    }
  };

  const setToNow = () => {
    setTime(formatDateTimeLocal(new Date()));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="mx-2 mb-2 text-xl font-semibold">Choose passage time</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="mx-2 text-sm font-bold">
            Passage time
          </label>
          <div className="mx-1 flex gap-2">
            <input
              ref={inputRef}
              id={inputId}
              name="time"
              type="datetime-local"
              className="flex-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required={true}
            />
            <button
              type="button"
              onClick={setToNow}
              className="btn-neutral whitespace-nowrap px-3 py-1 text-sm"
            >
              Now
            </button>
          </div>
        </div>

        <div className="mx-1 flex gap-1">
          <button
            type="submit"
            className="btn-primary mt-3 flex-1 py-1"
            disabled={isLoading}
          >
            Set time
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary mt-3 flex-1 py-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
});

export const SlotManagementDrawer = memo(function SlotManagementDrawer({
  slot,
  listSecret,
}: SlotManagementDrawerProps) {
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<SlotConfirmAction | null>(
    null,
  );
  const deleteSlot = useDeleteSlot();
  const updateToken = useAdminUpdateToken();

  const isTaken = slot.registered_token_id !== undefined;
  const hasRealTurnTime = slot.registered_real_turn_time !== undefined;
  const isLoading = deleteSlot.isPending || updateToken.isPending;

  const handleDeleteSlot = () => {
    deleteSlot.mutate({ listSecret, slotId: slot.id });
  };

  const handleMarkTurnedNow = () => {
    if (!slot.registered_token_id) return;
    updateToken.mutate({
      listSecret,
      tokenId: slot.registered_token_id,
      realTurnTime: new Date(),
    });
  };

  const handleMarkOnTime = () => {
    if (!slot.registered_token_id) return;
    updateToken.mutate({
      listSecret,
      tokenId: slot.registered_token_id,
      realTurnTime: slot.starts_at,
    });
  };

  const handleClearRealTurnTime = () => {
    if (!slot.registered_token_id) return;
    updateToken.mutate({
      listSecret,
      tokenId: slot.registered_token_id,
      clearFields: ["real_turn_time"],
    });
  };

  const handleChooseTime = (time: Date) => {
    if (!slot.registered_token_id) return;
    updateToken.mutate(
      {
        listSecret,
        tokenId: slot.registered_token_id,
        realTurnTime: time,
      },
      {
        onSuccess: () => setIsTimeModalOpen(false),
      },
    );
  };

  const handleUnregister = () => {
    if (!slot.registered_token_id) return;
    updateToken.mutate({
      listSecret,
      tokenId: slot.registered_token_id,
      clearFields: ["slot_id"],
    });
  };

  return (
    <div className="flex border-t border-neutral-700 divide-x divide-neutral-400 mt-1 h-8">
      {isTaken ? (
        <>
          {hasRealTurnTime ? (
            <>
              <button
                type="button"
                onClick={() => setIsTimeModalOpen(true)}
                disabled={isLoading}
                className="btn-flat-neutral text-xs py-0.5 px-2 flex-1"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleClearRealTurnTime}
                disabled={isLoading}
                className="btn-flat-neutral text-xs py-0.5 px-2 flex-1 text-amber-700"
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleMarkOnTime}
                disabled={isLoading}
                className="btn-flat-neutral text-xs py-0.5 px-2 flex-1 text-green-700"
              >
                On time
              </button>
              <button
                type="button"
                onClick={handleMarkTurnedNow}
                disabled={isLoading}
                className="btn-flat-neutral text-xs py-0.5 px-2 flex-1 text-amber-700"
              >
                Now
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setConfirmAction("unregister")}
            disabled={isLoading}
            className="btn-flat-neutral text-xs py-0.5 px-2 text-red-700 flex-1"
          >
            Unregister
          </button>
          <ChooseTimeModal
            isOpen={isTimeModalOpen}
            onClose={() => setIsTimeModalOpen(false)}
            onSubmit={handleChooseTime}
            defaultTime={slot.registered_real_turn_time}
            isLoading={isLoading}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmAction("delete")}
          disabled={isLoading}
          className="btn-flat-neutral text-red-700 text-xs flex-1"
        >
          Delete
        </button>
      )}
      <SlotConfirmModal
        action={confirmAction}
        slot={slot}
        isLoading={isLoading}
        onConfirm={
          confirmAction === "unregister" ? handleUnregister : handleDeleteSlot
        }
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
});
