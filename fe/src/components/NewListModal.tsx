import { type FormEvent, useId, useState } from "react";
import { Modal } from "../components/Modal";

interface NewListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewListModal({ isOpen, onClose }: NewListModalProps) {
  const [name, setName] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const nameInputId = useId();
  const opensAtInputId = useId();
  const closesAtInputId = useId();

  const resetAndClose = () => {
    setName("");
    setOpensAt("");
    setClosesAt("");
    onClose();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log({
      name,
      opens_at: opensAt || undefined,
      closes_at: closesAt || undefined,
    });
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose}>
      <h2 className="mx-2 mb-4 text-xl font-semibold">Create waiting list</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={nameInputId} className="mx-2 text-sm font-bold">
            Name
          </label>
          <input
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
          <input
            id={opensAtInputId}
            name="opens_at"
            type="datetime-local"
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={opensAt}
            onChange={(event) => setOpensAt(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={closesAtInputId} className="mx-2 text-sm font-bold">
            Closes at{" "}
            <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id={closesAtInputId}
            name="closes_at"
            type="datetime-local"
            className="mx-1 rounded-md border p-1 outline-pink-500 focus:border-white focus:outline-2"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
          />
        </div>

        <div className="mx-1 flex gap-1">
          <button type="submit" className="btn-primary mt-3 flex-1 py-1">
            Create list
          </button>
          <button
            type="button"
            onClick={resetAndClose}
            className="btn-secondary mt-3 flex-1 py-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
