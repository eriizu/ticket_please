import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type } from "arktype";
import { useEffect, useMemo, useState } from "react";
import { RegisterModal, type Registration } from "@/components/RegisterModal";
import { NewListModal } from "@/components/NewListModal";
import { GenSlotModal } from "@/components/GenSlotModal";
import { Slot, getSlotVariant } from "@/components/Slot";
import * as models from "../models";
import { groupSlotsByLocalStartDateSorted } from "../utils/slots";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const isFetch = useIsFetching();
  const [isCreatingList, setIsCreatingList] = useState(false);

  return (
    <>
      <TokenSumary />
      <div className="my-2 text-neutral-800">
        Requests status: {isFetch ? "fetching..." : "settled."}
      </div>
      <div className="my-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIsCreatingList(true)}
        >
          Create waiting list
        </button>
      </div>
      <ManyWaitingList />
      <NewListModal
        isOpen={isCreatingList}
        onClose={() => setIsCreatingList(false)}
      />
    </>
  );
}

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

  const [persistent, setPersistent] = usePersistent();

  const queryClient = useQueryClient();
  const unregisterMutation = useMutation({
    mutationFn: async (secret: string) => {
      const res = await fetch(`/api/token/${secret}`, { method: "DELETE" });
      if (res.status < 200 || res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
      return secret;
    },
    onSuccess: (secret) => {
      persistent.known_tokens = persistent.known_tokens.filter(
        (token) => token.secret !== secret,
      );
      setPersistent(persistent);
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["token"] });
    },
    onError: (e, secret) => {
      console.error(`unregistration failed for token ${secret}`, e);
    },
  });

  if (isPending) return <span>Loading...</span>;
  if (error) return <span>Oops!</span>;

  return (
    <div className="flex flex-col gap-4 ">
      {data.map((e) => (
        <SingleWaitingList
          key={e.id}
          list={e}
          setRegisteringFor={setRegisteringFor}
          registeredTokens={persistent.forList(e.id)}
          listSecret={persistent.known_lists[e.id] || null}
          onUnregister={(secret) => unregisterMutation.mutate(secret)}
          unregisteringSecret={
            unregisterMutation.isPending ? unregisterMutation.variables : null
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
  registeredTokens,
  onUnregister,
  unregisteringSecret,
  listSecret,
}: {
  list: typeof models.WaitingListRelated.infer;
  setRegisteringFor: (reg: Registration) => void;
  registeredTokens: (typeof models.KnownToken.infer)[];
  onUnregister: (secret: string) => void;
  unregisteringSecret: string | null;
  listSecret: string | null;
}) {
  const [isGeneratingSlots, setIsGeneratingSlots] = useState(false);
  const tata = useMemo(() => {
    const groupedslots = groupSlotsByLocalStartDateSorted(list.slots);
    return Object.entries(groupedslots).sort(([a], [b]) => a.localeCompare(b));
  }, [list.slots]);
  const queuedTokens = list.tokens.filter(
    (token) =>
      !token.slot_id &&
      (!token.real_turn_time || token.real_turn_time > new Date()),
  );

  // Find user's queued token (not assigned to a slot)
  const myQueuedToken = registeredTokens.find((t) => t.slot_id === null);
  const isUnregisteringQueued = myQueuedToken?.secret === unregisteringSecret;

  return (
    <SingleWaitingListTitle list={list}>
      <div>
        <h3 className="font-semibold">Next in line, not in a slot</h3>
        <div className="my-1">
          {myQueuedToken ? (
            <button
              type="button"
              className="before:content-['×'] before:mr-1 btn-secondary"
              onClick={() => onUnregister(myQueuedToken.secret)}
              disabled={isUnregisteringQueued}
            >
              {isUnregisteringQueued ? "unregistering..." : "unregister"}
            </button>
          ) : (
            <button
              type="button"
              className="before:content-['→'] before:mr-1 btn-secondary"
              onClick={() => setRegisteringFor({ list_id: list.id })}
            >
              take a ticket
            </button>
          )}
        </div>
        <ol>
          {queuedTokens.map((token) => (
            <li
              className="not-last:mb-0.5 before:content-['—'] before:mr-1"
              key={token.id}
            >
              {token.client_name}
              <span className="text-neutral-600 text-sm ml-1">#{token.id}</span>
            </li>
          ))}
        </ol>
      </div>
      {listSecret ? (
        <button
          type="button"
          className="btn-secondary w-fit"
          onClick={() => setIsGeneratingSlots(true)}
        >
          Generate slots
        </button>
      ) : null}
      {tata.map(([day, slots]) => (
        <div key={day}>
          <h3 className="font-semibold">{day}</h3>
          <SlotsGrid
            slots={slots}
            setRegisteringFor={setRegisteringFor}
            registeredTokens={registeredTokens}
            onUnregister={onUnregister}
            unregisteringSecret={unregisteringSecret}
          />
        </div>
      ))}
      {listSecret ? (
        <GenSlotModal
          isOpen={isGeneratingSlots}
          onClose={() => setIsGeneratingSlots(false)}
          listId={list.id}
          listName={list.name}
          listSecret={listSecret}
        />
      ) : null}
    </SingleWaitingListTitle>
  );
}

function SlotsGrid({
  slots,
  setRegisteringFor,
  registeredTokens,
  onUnregister,
  unregisteringSecret,
}: {
  setRegisteringFor: (reg: Registration) => void;
  slots: Array<typeof models.SlotBase.infer>;
  registeredTokens: (typeof models.KnownToken.infer)[];
  onUnregister: (secret: string) => void;
  unregisteringSecret: string | null;
}) {
  const registeredSlotIds = registeredTokens
    .map((t) => t.slot_id)
    .filter((id): id is number => id !== null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-1">
      {slots.map((slot) => {
        const variant = getSlotVariant(slot, registeredSlotIds);
        const token = registeredTokens.find((t) => t.slot_id === slot.id);
        return (
          <Slot
            key={slot.id}
            slot={slot}
            variant={variant}
            onRegister={variant === "open" ? setRegisteringFor : undefined}
            onUnregister={token ? () => onUnregister(token.secret) : undefined}
            isUnregistering={token?.secret === unregisteringSecret}
          />
        );
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
    <div className="flex flex-col gap-3 p-2 border rounded-xl border-neutral-500">
      <div>
        <div className="text-2xl">{list.name}</div>
        <div className="text-neutral-800 text-sm">
          <OpenedTimeInterval
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

function OpenedTimeInterval(props: {
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

import { TokenSumary } from "@/components/TokenSumary";
import { usePersistent } from "@/hooks/usePersistent";
import {
  type FormatRelativeTimeOptions,
  formatRelativeTime,
} from "../utils/date";

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
