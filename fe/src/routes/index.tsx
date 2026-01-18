import { useIsFetching } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { GenSlotModal } from "@/components/GenSlotModal";
import { NewListModal } from "@/components/NewListModal";
import { RegisterModal } from "@/components/RegisterModal";
import { getSlotVariant, Slot } from "@/components/Slot";
import { TokenSumary } from "@/components/TokenSumary";
import {
  type Registration,
  RegistrationProvider,
  useListRegistration,
  useRegistration,
} from "@/contexts/RegistrationContext";
import { useDeleteList } from "@/hooks/useDeleteList";
import { usePersistent } from "@/hooks/usePersistent";
import { useUnregisterToken } from "@/hooks/useUnregisterToken";
import { useWaitingLists } from "@/hooks/useWaitingLists";
import {
  absoluteDateFormatter,
  absoluteDateTimeFormatter,
  absoluteTimeFormatter,
} from "@/utils/formatters";
import { groupSlotsByLocalStartDateSorted } from "@/utils/slots";
import type * as models from "../models";

type WaitingList = typeof models.WaitingListRelated.infer;
type SlotData = typeof models.SlotBase.infer;
type WaitingToken = typeof models.WaitingTokenBase.infer;

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
  const [registeringFor, setRegisteringFor] = useState<Registration | null>(
    null,
  );
  const [persistent, setPersistent] = usePersistent();
  const unregisterMutation = useUnregisterToken(persistent, setPersistent);

  if (isPending) return <span>Loading...</span>;
  if (error) return <span>Oops!</span>;

  return (
    <RegistrationProvider
      setRegisteringFor={setRegisteringFor}
      onUnregister={(secret) => unregisterMutation.mutate(secret)}
      unregisteringSecret={
        unregisterMutation.isPending ? unregisterMutation.variables : null
      }
      registeredTokens={persistent.known_tokens}
    >
      <div className="flex flex-col gap-4">
        {data.map((list) => (
          <SingleWaitingList
            key={list.id}
            list={list}
            listSecret={persistent.known_lists[list.id] || null}
          />
        ))}
        {registeringFor && (
          <RegisterModal
            onClose={() => setRegisteringFor(null)}
            registeringFor={registeringFor}
          />
        )}
      </div>
    </RegistrationProvider>
  );
}

// -----------------------------------------------------------------------------
// SingleWaitingList - Main container for a waiting list
// -----------------------------------------------------------------------------

interface SingleWaitingListProps {
  list: WaitingList;
  listSecret: string | null;
}

const SingleWaitingList = memo(function SingleWaitingList({
  list,
  listSecret,
}: SingleWaitingListProps) {
  const { mutate: deleteList } = useDeleteList();
  const [isGeneratingSlots, setIsGeneratingSlots] = useState(false);
  const { getTokensForList, unregisteringSecret } = useRegistration();

  const registeredTokens = getTokensForList(list.id);

  const slotsByDay = useMemo(() => {
    const groupedSlots = groupSlotsByLocalStartDateSorted(list.slots);
    return Object.entries(groupedSlots).sort(([a], [b]) => a.localeCompare(b));
  }, [list.slots]);

  const queueState = useMemo(() => {
    const queuedTokens = list.tokens.filter(
      (token) =>
        !token.slot_id &&
        (!token.real_turn_time || token.real_turn_time > new Date()),
    );
    const myQueuedToken = registeredTokens.find((t) => t.slot_id === null);
    const isUnregisteringQueued = myQueuedToken?.secret === unregisteringSecret;

    return { queuedTokens, myQueuedToken, isUnregisteringQueued };
  }, [list.tokens, registeredTokens, unregisteringSecret]);

  const hasAdminAccess = Boolean(listSecret);
  const adminSecret = listSecret ?? "";

  return (
    <SingleWaitingListContainer list={list}>
      <QueueSection listId={list.id} queueState={queueState} />

      {hasAdminAccess && (
        <AdminActions
          onGenerateSlots={() => setIsGeneratingSlots(true)}
          onDeleteList={() => deleteList(adminSecret)}
        />
      )}

      <SlotsByDaySection slotsByDay={slotsByDay} listId={list.id} />

      {hasAdminAccess && (
        <GenSlotModal
          isOpen={isGeneratingSlots}
          onClose={() => setIsGeneratingSlots(false)}
          listId={list.id}
          listName={list.name}
          listSecret={adminSecret}
        />
      )}
    </SingleWaitingListContainer>
  );
});

// -----------------------------------------------------------------------------
// SingleWaitingListContainer - Layout wrapper with header
// -----------------------------------------------------------------------------

interface SingleWaitingListContainerProps {
  list: WaitingList;
  children: React.ReactNode;
}

const SingleWaitingListContainer = memo(function SingleWaitingListContainer({
  list,
  children,
}: SingleWaitingListContainerProps) {
  return (
    <div className="flex flex-col gap-3 p-2 border rounded-xl border-neutral-500">
      <div>
        <div className="text-2xl">{list.name}</div>
        <div className="text-neutral-800 text-sm">
          <OpenedTimeInterval
            start={list.opens_at}
            end={list.closes_at}
            startVerb="opens"
            endVerb="closes"
          />
        </div>
      </div>
      {children}
    </div>
  );
});

// -----------------------------------------------------------------------------
// QueueSection - Shows queued tokens and take-a-ticket button
// -----------------------------------------------------------------------------

interface QueueState {
  queuedTokens: WaitingToken[];
  myQueuedToken: { secret: string } | undefined;
  isUnregisteringQueued: boolean;
}

interface QueueSectionProps {
  listId: number;
  queueState: QueueState;
}

const QueueSection = memo(function QueueSection({
  listId,
  queueState,
}: QueueSectionProps) {
  const { setRegisteringFor, onUnregister } = useRegistration();
  const { queuedTokens, myQueuedToken, isUnregisteringQueued } = queueState;

  return (
    <div>
      <h3 className="font-semibold">Next in line, not in a slot</h3>
      <div className="my-1">
        {myQueuedToken ? (
          <button
            type="button"
            className="before:content-['x'] before:mr-1 btn-secondary"
            onClick={() => onUnregister(myQueuedToken.secret)}
            disabled={isUnregisteringQueued}
          >
            {isUnregisteringQueued ? "unregistering..." : "unregister"}
          </button>
        ) : (
          <button
            type="button"
            className="before:content-['→'] before:mr-1 btn-secondary"
            onClick={() => setRegisteringFor({ list_id: listId })}
          >
            take a ticket
          </button>
        )}
      </div>
      <ol>
        {queuedTokens.map((token) => (
          <li
            className="not-last:mb-0.5 before:content-['--'] before:mr-1"
            key={token.id}
          >
            {token.client_name}
            <span className="text-neutral-600 text-sm ml-1">#{token.id}</span>
          </li>
        ))}
      </ol>
    </div>
  );
});

// -----------------------------------------------------------------------------
// AdminActions - Admin-only buttons
// -----------------------------------------------------------------------------

interface AdminActionsProps {
  onGenerateSlots: () => void;
  onDeleteList: () => void;
}

const AdminActions = memo(function AdminActions({
  onGenerateSlots,
  onDeleteList,
}: AdminActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-secondary w-fit"
        onClick={onGenerateSlots}
      >
        Generate slots
      </button>
      <button
        type="button"
        className="btn-secondary w-fit"
        onClick={onDeleteList}
      >
        Delete list
      </button>
    </div>
  );
});

// -----------------------------------------------------------------------------
// SlotsByDaySection - Groups slots by day
// -----------------------------------------------------------------------------

interface SlotsByDaySectionProps {
  slotsByDay: Array<[string, SlotData[]]>;
  listId: number;
}

const SlotsByDaySection = memo(function SlotsByDaySection({
  slotsByDay,
  listId,
}: SlotsByDaySectionProps) {
  return (
    <>
      {slotsByDay.map(([day, slots]) => (
        <div key={day}>
          <h3 className="font-semibold">{day}</h3>
          <SlotsGrid slots={slots} listId={listId} />
        </div>
      ))}
    </>
  );
});

// -----------------------------------------------------------------------------
// SlotsGrid - Grid of slot components
// -----------------------------------------------------------------------------

interface SlotsGridProps {
  slots: SlotData[];
  listId: number;
}

const SlotsGrid = memo(function SlotsGrid({ slots, listId }: SlotsGridProps) {
  const { setRegisteringFor, onUnregister, unregisteringSecret } =
    useRegistration();
  const { tokens, registeredSlotIds } = useListRegistration(listId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-1">
      {slots.map((slot) => {
        const variant = getSlotVariant(slot, registeredSlotIds);
        const token = tokens.find((t) => t.slot_id === slot.id);

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
});

// -----------------------------------------------------------------------------
// OpenedTimeInterval - Displays open/close time range
// -----------------------------------------------------------------------------

interface OpenedTimeIntervalProps {
  start: Date | null;
  end: Date | null;
  startVerb: string;
  endVerb: string;
}

function OpenedTimeInterval({
  start,
  end,
  startVerb,
  endVerb,
}: OpenedTimeIntervalProps) {
  if (start && end) {
    if (start.getDate() === end.getDate()) {
      return (
        <>
          <span>{`${absoluteDateFormatter.format(start)} `}</span>
          <span>{`between ${absoluteTimeFormatter.format(start)} `}</span>
          <span>{`and ${absoluteTimeFormatter.format(end)}`}</span>
        </>
      );
    }
    return (
      <>
        <span>{`between ${absoluteDateTimeFormatter.format(start)}`}</span>
        <span>{` and ${absoluteDateTimeFormatter.format(end)}`}</span>
      </>
    );
  }

  if (start) {
    return (
      <span>{`${startVerb} ${absoluteDateTimeFormatter.format(start)}`}</span>
    );
  }

  if (end) {
    return <span>{`${endVerb} ${absoluteDateTimeFormatter.format(end)}`}</span>;
  }

  return <span>unknown start or end time</span>;
}
