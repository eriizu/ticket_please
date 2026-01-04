import { createFileRoute } from "@tanstack/react-router";
import * as models from "../models";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { groupSlotsByLocalStartDateSorted } from "../utils/slots";
import { Modal } from "../components/Modal";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { type } from "arktype";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const isFetch = useIsFetching();
  return (
    <>
      <div className="my-2">
        <TokenSumary />
      </div>
      <div className="my-2 text-neutral-800">
        Requests status: {isFetch ? "fetching..." : "settled."}
      </div>
      <ManyWaitingList />
    </>
  );
}

type Registration = {
  list_id: number;
  slot_id?: number;
};

function ManyWaitingList() {
  const { data, isPending, error } = useQuery({
    queryKey: ["list"],
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    retry: 3,
    queryFn: async () => fetch("/api/list?open=true").then((r) => r.json()),
    select: (raw) => {
      const out = models.WaitingListRelated.array()(raw);
      if (out instanceof type.errors) {
        console.error(out);
        throw out;
      }
      out.forEach((slit) => {
        models.matchSlotsToTokens(slit.slots, slit.tokens);
      });
      return out;
    },
  });

  const [registeringFor, setRegisteringFor] = useState<Registration | null>(
    null,
  );

  if (isPending) return <span>Loading...</span>;
  if (error) return <span>Oops!</span>;

  return (
    <div className="flex flex-col gap-4 ">
      {data.map((e) => (
        <SingleWaitingList
          key={e.id}
          list={e}
          setRegisteringFor={setRegisteringFor}
        />
      ))}
      {registeringFor && (
        <RegisterModal
          onClose={() => setRegisteringFor(null)}
          registeringFor={registeringFor}
        />
      )}
    </div>
  );
}

function RegisterModal(props: {
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
              setTimeout(props.onClose, 5000);
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
  const { data, isPending, error } = useQuery({
    queryKey: ["list", "slot", props.slot_id],
    refetchInterval: 1000,
    retry: 3,
    queryFn: async () =>
      await (await fetch(`/api/slot/${props.slot_id}`)).json(),
    select: (raw) => {
      console.log(raw);
      const parsed = models.SlotRelated(raw);
      if (parsed instanceof type.errors) {
        console.error(parsed);
        throw parsed;
      }
      return parsed;
    },
  });
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
    props.setUnvailable(true);
    data.registered_token_id = data.token.id;
    data.registered_client_name = data.token.client_name || undefined;
    return <SlotTaken1 slot={data} />;
  }
  if (data) return <SlotOpen2 slot={data} />;
}

function SlotBase(props: { children: React.ReactNode }) {
  return (
    <div className="border h-12 rounded-md p-1 flex items-center gap-3">
      {props.children}
    </div>
  );
}

function SlotOpen2({
  slot,
  setRegisteringFor: setRegistration,
}: {
  slot: typeof models.SlotBase.infer;
  setRegisteringFor?: (reg: Registration) => void;
}) {
  return (
    <SlotBase>
      <div className="w-20 flex-none">
        <div className="tabular-nums text-xl">
          {absoluteTimeFormater.format(slot.starts_at)}
        </div>
        {slot.starts_at > new Date() ? (
          <div className="text-green-800 text-xs font-mono">AVAILABLE</div>
        ) : (
          <div className="text-red-800 text-xs font-mono">PAST</div>
        )}
      </div>
      <div className="flex place-content-end w-full">
        {setRegistration && slot.starts_at > new Date() ? (
          <button
            type="button"
            className='btn-secondary before:content-["+"] before:mr-1'
            onClick={(_) => {
              setRegistration({ slot_id: slot.id, list_id: slot.list_id });
            }}
          >
            register
          </button>
        ) : null}
      </div>
    </SlotBase>
  );
}

function SlotTaken1({ slot }: { slot: typeof models.SlotBase.infer }) {
  return (
    <div className="text-neutral-700">
      <SlotBase>
        <div className="flex-none">
          <div className="tabular-nums text-xl">
            {absoluteTimeFormater.format(slot.starts_at)}
          </div>
          <div className="text-red-800 text-xs font-mono w-fit">NOT AVAIL.</div>
        </div>
        <div className="align-bottom">
          {/* <div className="text-red-800">:: not avail. ::</div>*/}
          <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
            {slot.registered_client_name}
          </div>
          <div className="text-xs">is currently registered</div>
        </div>
      </SlotBase>
    </div>
  );
}

function SingleWaitingList({
  list,
  setRegisteringFor,
}: {
  list: typeof models.WaitingListRelated.infer;
  setRegisteringFor: (reg: Registration) => void;
}) {
  const tata = useMemo(() => {
    const groupedslots = groupSlotsByLocalStartDateSorted(list.slots);
    return Object.entries(groupedslots).sort(([a], [b]) => a.localeCompare(b));
  }, [list.slots]);
  return (
    <SingleWaitingListTitle list={list}>
      <div>
        <h3 className="font-semibold">Next in line, not in a slot</h3>
        <ol className="">
          <button
            type="button"
            className="before:content-['→'] before:mr-1 btn-secondary"
            onClick={() => setRegisteringFor({ list_id: list.id })}
          >
            take a ticket
          </button>
          {list.tokens
            .filter(
              (token) =>
                !token.slot_id &&
                (!token.real_turn_time || token.real_turn_time > new Date()),
            )
            .map((token) => (
              <li
                className="not-last:mb-0.5 before:content-['—'] before:mr-1"
                key={token.id}
              >
                {token.client_name}
                <span className="text-neutral-600 text-sm ml-1">
                  #{token.id}
                </span>
              </li>
            ))}
        </ol>
      </div>
      {tata.map(([day, slots]) => (
        <div key={day}>
          <h3 className="font-semibold">{day}</h3>
          <SlotsGrid slots={slots} setRegisteringFor={setRegisteringFor} />
        </div>
      ))}
    </SingleWaitingListTitle>
  );
}

function SlotsGrid({
  slots,
  setRegisteringFor,
}: {
  setRegisteringFor: (reg: Registration) => void;
  slots: Array<typeof models.SlotBase.infer>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-1">
      {slots.map((slot) => {
        if (slot.registered_client_name) {
          return <SlotTaken1 slot={slot} key={slot.id} />;
        } else {
          return (
            <SlotOpen2
              slot={slot}
              key={slot.id}
              setRegisteringFor={setRegisteringFor}
            />
          );
        }
      })}
    </div>
  );
}

function SingleWaitingListTitle({
  list,
  children,
}: {
  list: typeof models.WaitingListRelated.infer;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-2 border rounded-md border-neutral-500">
      <div>
        <div className="text-2xl">{list.name}</div>
        <div className="text-neutral-800 text-sm">
          <OpenedTimeWindow
            start={list.opens_at}
            end={list.closes_at}
            start_verb="opens"
            end_verb="closes"
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function SingleWaitingListDetails({
  list,
  register,
}: {
  list: typeof models.WaitingListRelated.infer;
  register: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000); // update every second

    return () => clearInterval(id); // cleanup on unmount
  }, []);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 items-baseline w-fit">
        <BlockyCounter
          fieldName={{
            singular: "person waiting not slotted",
            other: "people waiting not slotted",
          }}
          value={list.tokens.filter((token) => !token.slot_id).length}
        />
        <button type="button" onClick={() => register()}>
          → take a ticket
        </button>
      </div>
      <div className="flex gap-4 items-baseline"></div>
    </>
  );
}

function OpenedTimeWindow(props: {
  start: Date | null;
  end: Date | null;
  start_verb: string;
  end_verb: string;
}) {
  const { start, end, start_verb, end_verb } = props;
  if (start && end) {
    if (start.getDate() === end.getDate()) {
      return (
        <>
          <span>{`${absoluteDateFormater.format(start)} `}</span>
          <span>{`between ${absoluteTimeFormater.format(start)} `}</span>
          <span>{`and ${absoluteTimeFormater.format(end)}`}</span>
        </>
      );
      // on date starts start.time, end end.time
    } else {
      return (
        <>
          <span>{`between ${absoluteDateTimeFormater.format(start)}`}</span>
          <span>{`and ${absoluteDateTimeFormater.format(end)}`}</span>
        </>
      );
      // starts start, ends end
    }
  } else if (start) {
    return (
      <span>{`${start_verb} ${absoluteDateTimeFormater.format(start)}`}</span>
    );
  } else if (end) {
    return <span>{`${end_verb} ${absoluteDateTimeFormater.format(end)}`}</span>;
  }
  return <span>unknown start or end time</span>;
}

function BlockyCounter({
  fieldName,
  value,
}: {
  fieldName: { singular: string; other: string };
  value: number;
}) {
  return (
    <div className="bg-neutral-100 flex w-fit">
      <div className="w-9 bg-neutral-300 text-center tabular-nums">{value}</div>
      <div className="px-2">
        {value === 1 ? fieldName.singular : fieldName.other}
      </div>
    </div>
  );
}

const absoluteDateTimeFormater = Intl.DateTimeFormat("en-IE", {
  dateStyle: "full",
  timeStyle: "short",
});

const absoluteTimeFormater = Intl.DateTimeFormat("en-IE", {
  timeStyle: "short",
});

const absoluteDateFormater = Intl.DateTimeFormat("en-IE", {
  dateStyle: "full",
});

import {
  formatRelativeTime,
  type FormatRelativeTimeOptions,
} from "../utils/date";
import { TokenSumary } from "@/components/TokenSumary";
import { useRegisterOnList } from "@/hooks/useRegisterOnList";
import { usePersistent } from "@/hooks/usePersistent";

function DateInWaitingList({
  fieldName,
  date,
}: {
  fieldName: string;
  date: Date | null;
}) {
  return (
    <div className="text-neutral-800">
      <div className="text-sm">{`${fieldName} `}</div>
      <div>{date ? absoluteDateTimeFormater.format(date) : "unknown"}</div>
      <div>
        {date ? (
          <span title={absoluteDateTimeFormater.format(date)}>
            {formatRelativeTime(date)}
          </span>
        ) : (
          "unknown"
        )}
      </div>
    </div>
  );
}
