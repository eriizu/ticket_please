import { type FormEvent, useId, useState, useEffect, useRef } from "react";
import { Modal } from "../components/Modal";
import { useCreateList } from "@/hooks/useCreateList";
import { usePersistent } from "@/hooks/usePersistent";

interface NewListModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const addHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

export function NewListModal({ isOpen, onClose }: NewListModalProps) {
  const [name, setName] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [closeModal, setCloseModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameInputId = useId();

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);
  const opensAtInputId = useId();
  const closesAtInputId = useId();
  const [persistent, setPersistent] = usePersistent();
  const {
    reset,
    isSuccess,
    isPending,
    status,
    mutate: createList,
  } = useCreateList(persistent, setPersistent);

  const setOpensToNow = () => {
    const now = new Date();
    const formattedNow = formatDateTimeLocal(now);
    setOpensAt(formattedNow);
    return now;
  };

  const handleSetOpensNow = () => {
    setOpensToNow();
  };

  const resolveOpenDate = () => {
    if (opensAt) {
      return new Date(opensAt);
    }

    return setOpensToNow();
  };

  const handleSetClosesAfterHours = (hours: number) => {
    const openDate = resolveOpenDate();
    const closesDate = addHours(openDate, hours);
    setClosesAt(formatDateTimeLocal(closesDate));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createList({
      name,
      opens_at: new Date(opensAt),
      closes_at: new Date(closesAt),
    });
    console.log({
      name,
      opens_at: opensAt || undefined,
      closes_at: closesAt || undefined,
    });
  };

  useEffect(() => {
    if (isSuccess || closeModal) {
      setName("");
      setOpensAt("");
      setClosesAt("");
      setCloseModal(false);
      reset();
      onClose();
    }
  }, [isSuccess, closeModal, onClose, reset]);

  return (
    <Modal isOpen={isOpen} onClose={() => setCloseModal(true)}>
      <h2 className="mx-2 mb-4 text-xl font-semibold">Create waiting list</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={nameInputId} className="mx-2 text-sm font-bold">
            Name
          </label>
          <input
            ref={nameInputRef}
            id={nameInputId}
            name="list_name"
            type="text"
            required
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={opensAtInputId} className="mx-2 text-sm font-bold">
            Opens at{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <div className="mx-1 flex gap-2">
            <input
              id={opensAtInputId}
              name="opens_at"
              type="datetime-local"
              className="flex-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
            />
            <button
              type="button"
              onClick={handleSetOpensNow}
              className="btn-secondary whitespace-nowrap px-3 py-1 text-sm"
            >
              Now
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={closesAtInputId} className="mx-2 text-sm font-bold">
            Closes at{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <div className="mx-1 flex gap-2">
            <input
              id={closesAtInputId}
              name="closes_at"
              type="datetime-local"
              className="flex-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleSetClosesAfterHours(4)}
                className="btn-secondary whitespace-nowrap px-3 py-1 text-sm"
              >
                +4h
              </button>
              <button
                type="button"
                onClick={() => handleSetClosesAfterHours(8)}
                className="btn-secondary whitespace-nowrap px-3 py-1 text-sm"
              >
                +8h
              </button>
            </div>
          </div>
        </div>

        <div className="mx-1 flex gap-1">
          <button type="submit" className="btn-primary mt-3 flex-1 py-1">
            Create list
          </button>
          <button
            type="button"
            onClick={() => setCloseModal(true)}
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
