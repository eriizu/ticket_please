import { createFileRoute } from "@tanstack/react-router";
import * as models from "../models";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { groupSlotsByLocalStartDateSorted } from "../utils/slots";
import { Modal } from "../components/Modal";
import { useQuery } from "@tanstack/react-query";
import { type } from "arktype";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <>
      <div className="my-2">
        <TokenSumary />
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
      console.log(out);
      return out;
    },
  });

  const [registeringFor, setRegisteringFor] = useState<Registration | null>(
    null,
  );

  if (isPending) return <span>Loading...</span>;
  if (error) return <span>Oops!</span>;

  return (
    <div className="flex flex-col gap-4 [&_button]:bg-neutral-200 [&_button:hover]:bg-neutral-300">
      {data.map((e) => (
        <>
          <MultiModeCard
            key={e.id}
            list={e}
            setRegisteringFor={setRegisteringFor}
          />
          {registeringFor && (
            <RegisterModal
              onClose={() => setRegisteringFor(null)}
              registeringFor={registeringFor}
            />
          )}
        </>
      ))}
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
      <form onSubmit={onSubmit} className="flex gap-4 flex-col">
        <div>
          <label htmlFor="client_name">Name</label>
          <input
            ref={inputRef}
            name="client_name"
            className="ml-1 p-1 border-b"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={isPending}
            className="border rounded-md bg-green-200 hover:bg-green-300 disabled:bg-amber-200 px-1"
          >
            Confirm
          </button>
        </div>
        <div>Status: {status}</div>
      </form>
    </Modal>
  );
}

function SlotOpen2({ slot }: { slot: typeof models.SlotBase.infer }) {
  return (
    <div className="border h-12 rounded-md p-1 flex items-center gap-3">
      <div className="w-20 flex-none">
        <div className="tabular-nums text-xl">
          {absoluteTimeFormater.format(slot.starts_at)}
        </div>
        <div className="text-green-800 text-xs font-mono">AVAILABLE</div>
      </div>
      <div className="flex place-content-end w-full">
        <button
          type="button"
          className="border rounded-sm w-fit px-1"
          onClick={(e) => { }}
        >
          + register
        </button>
      </div>
    </div>
  );
}

function SlotTaken1({ slot }: { slot: typeof models.SlotBase.infer }) {
  return (
    <div className="border h-12 rounded-md p-1 flex items-center gap-3 text-neutral-700">
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
    </div>
  );
}

type Mode = "wl" | "register" | "select_slot";
function MultiModeCard({
  list,
  setRegisteringFor,
}: {
  list: typeof models.WaitingListRelated.infer;
  setRegisteringFor: (reg: Registration) => void;
}) {
  const [mode, setMode] = useState<Mode>("wl");
  // const groupedslots = groupSlotsByLocalStartDateSorted(list.slots);
  // const tata = Object.entries(groupedslots).sort(([a], [b]) =>
  //   a.localeCompare(b),
  // );
  const tata = useMemo(() => {
    const groupedslots = groupSlotsByLocalStartDateSorted(list.slots);
    return Object.entries(groupedslots).sort(([a], [b]) => a.localeCompare(b));
  }, [list.slots]);
  if (mode === "wl") {
    return (
      <SingleWaitingListTitle list={list}>
        {tata.map(([day, slots]) => (
          <div key={day}>
            <h3 className="">{day}</h3>
            <SlotsGrid slots={slots} />
          </div>
        ))}
        <SingleWaitingListDetails
          list={list}
          register={() => setRegisteringFor({ list_id: list.id })}
        />
      </SingleWaitingListTitle>
    );
  } else if (mode === "register") {
    return (
      <SingleWaitingListTitle list={list}>
        <button
          className="w-fit"
          type="button"
          onClick={(_) => {
            setMode("wl");
          }}
        >
          back{" "}
        </button>
      </SingleWaitingListTitle>
    );
  } else {
  }
}

function SlotsGrid({ slots }: { slots: Array<typeof models.SlotBase.infer> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-1">
      {slots.map((slot) => {
        if (slot.registered_client_name) {
          return <SlotTaken1 slot={slot} key={slot.id} />;
        } else {
          return <SlotOpen2 slot={slot} key={slot.id} />;
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
          fieldName={{ singular: "person waiting", other: "people waiting" }}
          value={list.tokens.filter((token) => !token.slot_id).length}
        />
        <button type="button" onClick={() => register()}>
          → take a ticket
        </button>
        <BlockyCounter
          fieldName={{ singular: "person slotted", other: "people slotted" }}
          value={
            list.tokens.filter(
              (token) =>
                token.slot_id &&
                (!token.real_turn_time || token.real_turn_time > now),
            ).length
          }
        />
        <div></div>
        <BlockyCounter
          fieldName={{ singular: "available slot", other: "available slots" }}
          value={
            list.slots.filter(
              (slot) => !slot.registered_token_id && slot.starts_at > now,
            ).length
          }
        />
        <button type="button">→ take a slot</button>
        <BlockyCounter
          fieldName={{ singular: "unique slot", other: "total slots" }}
          value={list.slots.length}
        />
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
