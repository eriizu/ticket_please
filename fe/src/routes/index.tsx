import { useIsFetching } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GenSlotModal } from "@/components/GenSlotModal";
import { NewListModal } from "@/components/NewListModal";
import { type Registration as RegisteringFor, RegisterModal } from "@/components/RegisterModal";
import { getSlotVariant, Slot } from "@/components/Slot";
import { TokenSumary } from "@/components/TokenSumary";
import { useDeleteList } from "@/hooks/useDeleteList";
import { usePersistent } from "@/hooks/usePersistent";
import { useUnregisterToken } from "@/hooks/useUnregisterToken";
import { useWaitingLists } from "@/hooks/useWaitingLists";
import type * as models from "../models";
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
  const { data, isPending, error } = useWaitingLists();
  const [registeringFor, setRegisteringFor] = useState<RegisteringFor | null>(
    null,
  );
  const [persistent, setPersistent] = usePersistent();
  const unregisterMutation = useUnregisterToken(persistent, setPersistent);

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
  setRegisteringFor: (reg: RegisteringFor) => void;
  registeredTokens: (typeof models.KnownToken.infer)[];
  onUnregister: (secret: string) => void;
  unregisteringSecret: string | null;
  listSecret: string | null;
}) {
  const { mutate: delete_list } = useDeleteList();
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
    <SingleWaitingListContainer list={list}>
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
        <>
          <button
            type="button"
            className="btn-secondary w-fit"
            onClick={() => setIsGeneratingSlots(true)}
          >
            Generate slots
          </button>
          <button
            type="button"
            className="btn-secondary w-fit"
            onClick={() => delete_list(listSecret)}
          >
            Delete list
          </button>
        </>
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
    </SingleWaitingListContainer>
  );
}

function SlotsGrid({
  slots,
  setRegisteringFor,
  registeredTokens,
  onUnregister,
  unregisteringSecret,
}: {
  setRegisteringFor: (reg: RegisteringFor) => void;
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

function SingleWaitingListContainer({
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
    } else {
      return (
        <>
          <span>{`between ${absoluteDateTimeFormater.format(start)}`}</span>
          <span>{` and ${absoluteDateTimeFormater.format(end)}`}</span>
        </>
      );
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
