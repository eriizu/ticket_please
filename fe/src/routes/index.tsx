import { useIsFetching } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KnownTokenCard } from "@/components/KnownTokenCard";
import { NewListModal } from "@/components/NewListModal";
import { RegisterModal } from "@/components/RegisterModal";
import { TokenSumary } from "@/components/TokenSumary";
import {
  SingleWaitingList,
  SingleWaitingListContainer,
} from "@/components/WaitingList";
import type { Registration } from "@/contexts/RegistrationContext";
import { usePersistent } from "@/hooks/usePersistent";
import { useWaitingLists } from "@/hooks/useWaitingLists";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [persistent, _] = usePersistent();

  return (
    <>
      <TokenSumary />
      {persistent.known_tokens.length > 0 && (
        <div className="my-4">
          <h2 className="text-lg font-semibold text-neutral-800 mb-2">
            Your Registrations
          </h2>
          <div className="flex flex-col gap-2">
            {persistent.known_tokens.map((token) => (
              <KnownTokenCard key={token.id} secret={token.secret} />
            ))}
          </div>
        </div>
      )}
      {persistent.list_master && (
        <>
          <div className="my-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsCreatingList(true)}
            >
              Create waiting list
            </button>
          </div>
          <ManyWaitingList list_master={persistent.list_master} />
        </>
      )}
      <NewListModal
        isOpen={isCreatingList}
        onClose={() => setIsCreatingList(false)}
      />
    </>
  );
}

function ManyWaitingList(props: { list_master: string }) {
  const [persistent, _] = usePersistent();
  const [includeClosed, setIncludeClosed] = useState(false);
  const { data, isPending, error } = useWaitingLists(
    props.list_master,
    includeClosed,
  );
  const [registeringFor, setRegisteringFor] = useState<Registration | null>(
    null,
  );

  const renderContent = () => {
    if (isPending) {
      return (
        <SingleWaitingListContainer>
          <div className="flex-1 flex items-center justify-center text-neutral-700 p-10">
            <div>Loading lists...</div>
          </div>
        </SingleWaitingListContainer>
      );
    }
    if (error) {
      return (
        <SingleWaitingListContainer>
          <div className="flex-1 flex items-center justify-center text-red-700 p-10">
            <div>Loading failure</div>
          </div>
        </SingleWaitingListContainer>
      );
    }
    if (data.length === 0) {
      return (
        <SingleWaitingListContainer>
          <div className="flex-1 flex items-center justify-center text-neutral-700 p-10">
            <div>No lists are currently open.</div>
          </div>
        </SingleWaitingListContainer>
      );
    }
    return data.map((list) => (
      <SingleWaitingList
        key={list.id}
        list={list}
        listManagmentSecret={persistent.known_lists[list.id] || null}
      />
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={includeClosed}
          onChange={(event) => setIncludeClosed(event.target.checked)}
        />
        Include closed lists
      </label>
      {renderContent()}
      {registeringFor && (
        <RegisterModal
          onClose={() => setRegisteringFor(null)}
          registeringFor={registeringFor}
        />
      )}
    </div>
  );
}
