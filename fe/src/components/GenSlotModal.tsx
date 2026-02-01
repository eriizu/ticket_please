import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Modal } from "../components/Modal";
import { useGenerateSlots } from "@/hooks/useGenerateSlots";

interface GenSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: number;
  listName: string;
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

export function GenSlotModal({
  isOpen,
  onClose,
  listId,
  listName,
  listSecret,
}: GenSlotModalProps) {
  const [start, setStart] = useState("");
  const [slot_duration_minutes, setSlotDurationMinutes] = useState("30");
  const [break_duration_minutes, setBreakDurationMinutes] = useState("15");
  const [break_every_n_slots, setBreakEveryNSlots] = useState("3");
  const [slot_number, setSlotNumber] = useState("5");
  const {
    reset,
    status,
    mutate: generateSlots,
    isSuccess,
  } = useGenerateSlots();

  const startInputRef = useRef<HTMLInputElement>(null);
  const startInputId = useId();
  const slotDurationInputId = useId();

  useEffect(() => {
    if (isOpen && startInputRef.current) {
      startInputRef.current.focus();
    }
  }, [isOpen]);
  const breakDurationInputId = useId();
  const breakEveryInputId = useId();
  const slotNumberInputId = useId();

  const setStartToNow = () => {
    const now = new Date();
    setStart(formatDateTimeLocal(now));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    generateSlots({
      start: new Date(start),
      slot_duration_minutes: Number(slot_duration_minutes),
      break_duration_minutes: Number(break_duration_minutes),
      break_every_n_slots: Number(break_every_n_slots),
      slot_number: Number(slot_number),
      list_secret: listSecret,
    });
    console.log({
      list_id: listId,
      list_name: listName,
      start,
      slot_duration_minutes: Number(slot_duration_minutes),
      break_duration_minutes: Number(break_duration_minutes),
      break_every_n_slots: Number(break_every_n_slots),
      slot_number: Number(slot_number),
    });
  };

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    setStart("");
    setSlotDurationMinutes("30");
    setBreakDurationMinutes("15");
    setBreakEveryNSlots("3");
    setSlotNumber("5");
    reset();
    onClose();
  }, [isSuccess, reset, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
      }}
    >
      <h2 className="mx-2 mb-2 text-xl font-semibold">Generate slots</h2>
      <div className="mx-2 mb-2 text-neutral-700">
        List name:{" "}
        <span className="font-semibold text-neutral-800">{listName}</span>
        <span className="ml-1 text-neutral-700">#{listId}</span>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={startInputId} className="mx-2 text-sm font-bold">
            Start
          </label>
          <div className="mx-1 flex gap-2">
            <input
              ref={startInputRef}
              id={startInputId}
              name="start"
              type="datetime-local"
              className="flex-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              required={true}
            />
            <button
              type="button"
              onClick={setStartToNow}
              className="btn-secondary whitespace-nowrap px-3 py-1 text-sm"
            >
              Now
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={slotDurationInputId}
            className="mx-2 text-sm font-bold"
          >
            Slot duration (minutes)
          </label>
          <input
            id={slotDurationInputId}
            name="slot_duration_minutes"
            type="number"
            min={1}
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={slot_duration_minutes}
            onChange={(event) => setSlotDurationMinutes(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={breakDurationInputId}
            className="mx-2 text-sm font-bold"
          >
            Break duration (minutes)
          </label>
          <input
            id={breakDurationInputId}
            name="break_duration_minutes"
            type="number"
            min={0}
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={break_duration_minutes}
            onChange={(event) => setBreakDurationMinutes(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={breakEveryInputId} className="mx-2 text-sm font-bold">
            Number of slots before break
          </label>
          <input
            id={breakEveryInputId}
            name="break_every_n_slots"
            type="number"
            min={1}
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={break_every_n_slots}
            onChange={(event) => setBreakEveryNSlots(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={slotNumberInputId} className="mx-2 text-sm font-bold">
            Number of slots to generate
          </label>
          <input
            id={slotNumberInputId}
            name="slot_number"
            type="number"
            min={1}
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={slot_number}
            onChange={(event) => setSlotNumber(event.target.value)}
          />
        </div>

        <div className="mx-1 flex gap-1">
          <button type="submit" className="btn-primary mt-3 flex-1 py-1">
            Generate slots
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="btn-secondary mt-3 flex-1 py-1"
          >
            Cancel
          </button>
        </div>
        <div className="mx-2">Status: {status}</div>
      </form>
    </Modal>
  );
}
