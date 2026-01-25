import { useIsFetching } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NewListModal } from "@/components/NewListModal";
import { RegisterModal } from "@/components/RegisterModal";
import { TokenSumary } from "@/components/TokenSumary";
import { SingleWaitingList, SingleWaitingListContainer } from "@/components/WaitingList";
import {
  type Registration,
  RegistrationProvider,
} from "@/contexts/RegistrationContext";
import { usePersistent } from "@/hooks/usePersistent";
import { useUnregisterToken } from "@/hooks/useUnregisterToken";
import { useWaitingLists } from "@/hooks/useWaitingLists";

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

  if (isPending)
    return (
      <SingleWaitingListContainer>
        <div className="flex-1 flex items-center justify-center text-neutral-700 p-10">
          <div>Loading lists...</div>
        </div>
      </SingleWaitingListContainer>
    );
  if (error)
    return (
      <SingleWaitingListContainer>
        <div className="flex-1 flex items-center justify-center text-red-700 p-10">
          <div>Loading failure</div>
        </div>
      </SingleWaitingListContainer>
    );
  if (data.length === 0) {
    return (
      <SingleWaitingListContainer>
        <div className="flex-1 flex items-center justify-center text-neutral-700 p-10">
          <div>No lists are currently open.</div>
        </div>
      </SingleWaitingListContainer>
    );
  }

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
            listManagmentSecret={persistent.known_lists[list.id] || null}
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
