import { memo, useMemo, useState } from "react";
import { GenSlotModal } from "@/components/GenSlotModal";
import { RegistrationsTable } from "@/components/RegistrationsTable";
import { getSlotVariant, Slot } from "@/components/Slot";
import type { Registration } from "@/contexts/RegistrationContext";
import { useDeleteList } from "@/hooks/useDeleteList";
import { usePersistent } from "@/hooks/usePersistent";
import { useUnregisterToken } from "@/hooks/useUnregisterToken";
import { useWaitingListInvite } from "@/hooks/useWaitingLists";
import {
  absoluteDateFormatter,
  absoluteDateTimeFormatter,
  absoluteTimeFormatter,
} from "@/utils/formatters";
import { groupSlotsByLocalStartDateSorted } from "@/utils/slots";
import type * as models from "../models";
import { RegisterModal } from "./RegisterModal";

type WaitingList = typeof models.WaitingListRelated.infer;
type SlotData = typeof models.SlotBase.infer;
type WaitingToken = typeof models.WaitingTokenBase.infer;

interface SingleWaitingListProps {
  list: WaitingList;
  listManagmentSecret: string | null;
  invite?: string;
}

export const SingleWaitingList = memo(
  ({ list, listManagmentSecret, invite }: SingleWaitingListProps) => {
    const [persistent] = usePersistent();

    const registeredTokens = persistent.forList(list.id);

    const queueState = useMemo(() => {
      const queuedTokens = list.tokens.filter(
        (token) =>
          !token.slot_id &&
          (!token.real_turn_time || token.real_turn_time > new Date()),
      );
      // TODO: figure out if this is correct?
      // i have the feeling that stoping at the first known token of this list without
      // a slot id not to be the right thing to do, espacially if there a multiple
      const mySecret = registeredTokens.find((t) => t.slot_id === null)?.secret;

      return { queuedTokens, mySecret };
    }, [list.tokens, registeredTokens]);

    return (
      <SingleWaitingListContainer>
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

        {listManagmentSecret && (
          <AdminActions list={list} managmentSecret={listManagmentSecret} />
        )}

        <QueueSection
          listId={list.id}
          queuedTokens={queueState.queuedTokens}
          mySecret={queueState.mySecret}
          invite={invite}
        />

        <SlotsByDaySection
          slots={list.slots}
          listId={list.id}
          invite={invite}
          listSecret={listManagmentSecret || undefined}
        />
      </SingleWaitingListContainer>
    );
  },
);

// -----------------------------------------------------------------------------
// SingleWaitingListContainer - Layout wrapper with header
// -----------------------------------------------------------------------------

interface SingleWaitingListContainerProps {
  children: React.ReactNode;
}

export const SingleWaitingListContainer = memo(
  function SingleWaitingListContainer({
    children,
  }: SingleWaitingListContainerProps) {
    return (
      <div className="flex flex-col gap-3 p-2 border rounded-xl border-neutral-300">
        {children}
      </div>
    );
  },
);

// -----------------------------------------------------------------------------
// QueueSection - Shows queued tokens and take-a-ticket button
// -----------------------------------------------------------------------------

interface QueueSectionProps {
  listId: number;
  queuedTokens: WaitingToken[];
  mySecret?: string;
  invite?: string;
}

const QueueSection = memo(
  ({ listId, queuedTokens, mySecret, invite }: QueueSectionProps) => {
    const [registeringFor, setRegisteringFor] = useState<Registration | null>(
      null,
    );
    const { mutate: unregister, isPending } = useUnregisterToken();

    return (
      <div>
        <h3 className="font-semibold">Next in line, not in a slot</h3>
        <div className="my-1">
          {mySecret ? (
            <button
              type="button"
              className="before:content-['✕'] before:mr-1 btn-secondary"
              onClick={() => {
                unregister(mySecret);
              }}
              disabled={isPending}
            >
              {isPending ? "unregistering..." : "unregister"}
            </button>
          ) : (
            <button
              type="button"
              className="before:content-['→'] before:mr-1 btn-secondary w-full md:w-fit"
              onClick={() => setRegisteringFor({ list_id: listId, invite })}
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
        {registeringFor && (
          <RegisterModal
            onClose={() => setRegisteringFor(null)}
            registeringFor={registeringFor}
          />
        )}
      </div>
    );
  },
);

// -----------------------------------------------------------------------------
// AdminActions - Admin-only buttons
// -----------------------------------------------------------------------------

interface AdminActionsProps {
  list: WaitingList;
  managmentSecret: string;
}

const AdminActions = memo(({ list, managmentSecret }: AdminActionsProps) => {
  const [isModalSlotOpen, setIsModalSlotOpen] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const { mutate: deleteList } = useDeleteList();
  return (
    <>
      <div className="flex flex-col md:flex-row flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary md:w-fit"
          onClick={() => setIsModalSlotOpen(true)}
        >
          Generate slots
        </button>
        <button
          type="button"
          className="btn-secondary md:w-fit"
          onClick={() => deleteList(managmentSecret)}
        >
          Delete list
        </button>
        <Invite managmentSecret={managmentSecret} />
        {/*<button
          type="button"
          className="btn-secondary w-fit"
          onClick={() => setShowRegistrations(!showRegistrations)}
        >
          {showRegistrations ? "Hide" : "Show"} registrations (
          {list.tokens.length})
        </button>*/}
      </div>
      {showRegistrations && (
        <RegistrationsTable tokens={list.tokens} listSecret={managmentSecret} />
      )}
      <GenSlotModal
        isOpen={isModalSlotOpen}
        onClose={() => setIsModalSlotOpen(false)}
        listId={list.id}
        listName={list.name}
        listSecret={managmentSecret}
      />
    </>
  );
});

const Invite = ({ managmentSecret }: { managmentSecret: string }) => {
  const { data: invite, isLoading: inviteIsLoading } =
    useWaitingListInvite(managmentSecret);
  const [copied, setCopied] = useState(false);
  if (inviteIsLoading) {
    return <>Loading invite</>;
  }
  if (invite) {
    const inviteCode = invite.invite_code;
    if (!inviteCode) {
      return <>No invite link</>;
    }
    const invitePath = `/lists/${inviteCode}`;
    const inviteLink = `${window.location.origin}${invitePath}`;
    const displayCode =
      inviteCode.length > 10
        ? `${inviteCode.slice(0, 6)}...${inviteCode.slice(-4)}`
        : inviteCode;

    const copyToClipboard = () => {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(inviteLink);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = inviteLink;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    };

    return (
      <button
        type="button"
        className="btn-secondary md:w-50"
        onClick={copyToClipboard}
        title="Copy invite link"
      >
        invite: {copied ? "copied" : displayCode}
      </button>
    );
  }
  return <>No invite link</>;
};

// -----------------------------------------------------------------------------
// SlotsByDaySection - Groups slots by day
// -----------------------------------------------------------------------------

interface SlotsByDaySectionProps {
  slots: SlotData[];
  listId: number;
  invite?: string;
  listSecret?: string;
}

const SlotsByDaySection = memo(
  ({ listSecret, listId, invite, slots }: SlotsByDaySectionProps) => {
    const slotsByDay = useMemo(() => {
      const groupedSlots = groupSlotsByLocalStartDateSorted(slots);
      return Object.entries(groupedSlots).sort(([a], [b]) =>
        a.localeCompare(b),
      );
    }, [slots]);

    return (
      <>
        {slotsByDay.map(([day, slots]) => (
          <div key={day}>
            <h3 className="font-semibold">{day}</h3>
            <SlotsGrid
              slots={slots}
              listId={listId}
              invite={invite}
              listSecret={listSecret}
            />
          </div>
        ))}
      </>
    );
  },
);

// -----------------------------------------------------------------------------
// SlotsGrid - Grid of slot components
// -----------------------------------------------------------------------------

interface SlotsGridProps {
  slots: SlotData[];
  listId: number;
  invite?: string;
  listSecret?: string;
}

const SlotsGrid = memo(
  ({ slots, listSecret, listId, invite }: SlotsGridProps) => {
    const [persistent] = usePersistent();

    const tokens = persistent.forList(listId);
    const registeredSlotIds = tokens
      .map((t) => t.slot_id)
      .filter((id): id is number => id !== null);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-1">
        {slots.map((slot) => {
          let variant = getSlotVariant(slot, registeredSlotIds);
          if (variant === "open" && listSecret) {
            variant = "open-muted";
          }
          const token = tokens.find((t) => t.slot_id === slot.id);

          return (
            <Slot
              key={slot.id}
              slot={slot}
              variant={variant}
              secret={token?.secret}
              invite={invite}
              listSecret={listSecret}
            />
          );
        })}
      </div>
    );
  },
);

// -----------------------------------------------------------------------------
// OpenedTimeInterval - Displays open/close time range
// -----------------------------------------------------------------------------

interface OpenedTimeIntervalProps {
  start: Date | null;
  end: Date | null;
  startVerb: string;
  endVerb: string;
}

const OpenedTimeInterval = memo(
  ({ start, end, startVerb, endVerb }: OpenedTimeIntervalProps) => {
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
      return (
        <span>{`${endVerb} ${absoluteDateTimeFormatter.format(end)}`}</span>
      );
    }

    return <span>unknown start or end time</span>;
  },
);
