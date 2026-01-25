import { useQuery } from "@tanstack/react-query";
import { type } from "arktype";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Registration } from "@/contexts/RegistrationContext";
import { usePersistent } from "@/hooks/usePersistent";
import { useRegisterOnList } from "@/hooks/useRegisterOnList";
import { Modal } from "../components/Modal";
import * as models from "../models";
import { Slot, SlotBase } from "./Slot";
import { useListSlot } from "@/hooks/useListSlot";

export type { Registration };

export function RegisterModal(props: {
  onClose: () => void;
  registeringFor: Registration;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!!props.registeringFor && inputRef.current) {
      inputRef.current.focus();
    }
  }, [props.registeringFor]);

  const [storage, setStorage] = usePersistent();
  const [clientName, setClientName] = useState(storage.last_used_name || "");
  const [unavailable, setUnavailable] = useState(false);
  const [autoCloseTO, setAutoCloseTO] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      clearTimeout(autoCloseTO || undefined);
      setAutoCloseTO(null);
    };
  }, [autoCloseTO]);

  const {
    isPending,
    status,
    mutate: registerOnList,
  } = useRegisterOnList(
    {
      list_id: props.registeringFor.list_id,
      slot_id: props.registeringFor.slot_id,
    },
    storage,
    setStorage,
  );
  useEffect(() => {
    if (status === "success") {
      props.onClose();
    }
  }, [status, props.onClose]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    registerOnList(clientName);
  };

  return (
    <Modal
      isOpen={!!props.registeringFor}
      onClose={props.onClose}
      title="Name for the registration?"
    >
      <h2 className="mx-2 mb-4 text-xl font-semibold">Complete registration</h2>
      <div className="mx-1 my-3">
        {props.registeringFor.slot_id ? (
          <SlotAvailability
            slot_id={props.registeringFor.slot_id}
            setUnvailable={(x) => {
              setUnavailable(x);
              if (x) {
                setAutoCloseTO(setTimeout(props.onClose, 5000));
              }
            }}
          />
        ) : (
          <SlotBase>
            <div className="w-full text-center text-neutral-700">
              No slot selected.
            </div>
          </SlotBase>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-1">
        <label htmlFor="client_name" className="text-sm font-bold mx-2">
          Name
        </label>
        <input
          ref={inputRef}
          name="client_name"
          className="mx-1 p-1 border rounded-md focus:outline-2 focus:border-white outline-pink-500"
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          disabled={isPending || unavailable}
        />
        <div className="flex gap-1 mx-1">
          <button
            type="submit"
            disabled={isPending || unavailable}
            className="flex-1 btn-primary mt-3 py-1"
          >
            Register
          </button>
          <button
            onClick={() => props.onClose()}
            type="button"
            disabled={isPending}
            className="flex-1 btn-secondary mt-3 py-1"
          >
            Cancel
          </button>
        </div>
        <div className="mx-2">Status: {status}</div>
      </form>
    </Modal>
  );
}

function SlotAvailability(props: {
  slot_id: number;
  setUnvailable: (x: boolean) => void;
}) {
  const { data, isPending, error, isStale, isRefetching } = useListSlot(
    props.slot_id,
  );
  useEffect(() => {
    if (data?.token && !isStale && !isRefetching) {
      props.setUnvailable(true);
    } else {
      props.setUnvailable(false);
    }
  }, [data, isStale, isRefetching, props.setUnvailable]);
  if (isPending) {
    return (
      <SlotBase>
        <div className="w-full text-center text-neutral-700">
          Loading slot #{props.slot_id}...
        </div>
      </SlotBase>
    );
  }
  if (error) {
    return (
      <SlotBase>
        <div className="w-full text-center text-neutral-700">
          Failed to load slot #{props.slot_id}.
        </div>
      </SlotBase>
    );
  }
  if (data?.token) {
    data.registered_token_id = data.token.id;
    data.registered_client_name = data.token.client_name || undefined;
    return <Slot slot={data} variant="taken" />;
  }
  if (data) return <Slot slot={data} variant="open-muted" />;
}
