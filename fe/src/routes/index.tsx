import { createFileRoute } from "@tanstack/react-router";
import * as models from "../models";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { groupSlotsByLocalStartDateSorted } from "../utils/slots";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { type } from "arktype";
import { RegisterModal } from "@/components/RegisterModal";
import { SlotTaken1, SlotOpen2, SlotMine } from "@/components/Slot";

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

  const [persistent] = usePersistent();

  if (isPending) return <span>Loading...</span>;
  if (error) return <span>Oops!</span>;

  return (
    <div className="flex flex-col gap-4 ">
      {data.map((e) => (
        <SingleWaitingList
          key={e.id}
          list={e}
          setRegisteringFor={setRegisteringFor}
          registered_on_slot_ids={
            persistent
              .forList(e.id)
              .map((item) => item.slot_id)
              .filter((item) => !!item) as number[]
          }
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

function SingleWaitingList({
  list,
  setRegisteringFor,
  registered_on_slot_ids,
}: {
  list: typeof models.WaitingListRelated.infer;
  setRegisteringFor: (reg: Registration) => void;
  registered_on_slot_ids: number[];
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
          <SlotsGrid
            slots={slots}
            setRegisteringFor={setRegisteringFor}
            registered_on_slot_ids={registered_on_slot_ids}
          />
        </div>
      ))}
    </SingleWaitingListTitle>
  );
}

function SlotsGrid({
  slots,
  setRegisteringFor,
  registered_on_slot_ids,
}: {
  setRegisteringFor: (reg: Registration) => void;
  slots: Array<typeof models.SlotBase.infer>;
  registered_on_slot_ids: number[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-1">
      {slots.map((slot) => {
        if (registered_on_slot_ids.some((item) => item === slot.id)) {
          return <SlotMine slot={slot} key={slot.id} />;
        } else if (slot.registered_client_name) {
          return <SlotTaken1 slot={slot} key={slot.id} />;
        } else {
          return (
            <SlotOpen2
              slot={slot}
              key={slot.id}
              setRegisteringFor={setRegisteringFor}
              registered_somewhere_else={!!registered_on_slot_ids.length}
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
