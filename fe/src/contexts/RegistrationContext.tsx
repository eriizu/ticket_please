import { createContext, type ReactNode, useContext, useMemo } from "react";
import type * as models from "../models";

type KnownToken = typeof models.KnownToken.infer;

export type Registration = {
  list_id: number;
  slot_id?: number;
};

interface RegistrationContextValue {
  /** Open the registration modal for a list/slot */
  setRegisteringFor: (reg: Registration) => void;
  /** Unregister a token by its secret */
  onUnregister: (secret: string) => void;
  /** The secret currently being unregistered (for loading state) */
  unregisteringSecret: string | null;
  /** All tokens the user has registered */
  registeredTokens: KnownToken[];
  /** Get registered tokens for a specific list */
  getTokensForList: (listId: number) => KnownToken[];
  /** Get all slot IDs the user is registered for */
  getRegisteredSlotIds: () => number[];
}

const RegistrationContext = createContext<RegistrationContextValue | null>(
  null,
);

interface RegistrationProviderProps {
  children: ReactNode;
  setRegisteringFor: (reg: Registration) => void;
  onUnregister: (secret: string) => void;
  unregisteringSecret: string | null;
  registeredTokens: KnownToken[];
}

export function RegistrationProvider({
  children,
  setRegisteringFor,
  onUnregister,
  unregisteringSecret,
  registeredTokens,
}: RegistrationProviderProps) {
  const value = useMemo<RegistrationContextValue>(
    () => ({
      setRegisteringFor,
      onUnregister,
      unregisteringSecret,
      registeredTokens,
      getTokensForList: (listId: number) =>
        registeredTokens.filter((t) => t.list_id === listId),
      getRegisteredSlotIds: () =>
        registeredTokens
          .map((t) => t.slot_id)
          .filter((id): id is number => id !== null),
    }),
    [setRegisteringFor, onUnregister, unregisteringSecret, registeredTokens],
  );

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration(): RegistrationContextValue {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error(
      "useRegistration must be used within a RegistrationProvider",
    );
  }
  return context;
}

/**
 * Hook to get registration state for a specific list.
 * Returns memoized values to prevent unnecessary re-renders.
 */
export function useListRegistration(listId: number) {
  const { getTokensForList, onUnregister, unregisteringSecret } =
    useRegistration();

  return useMemo(() => {
    const tokens = getTokensForList(listId);
    const registeredSlotIds = tokens
      .map((t) => t.slot_id)
      .filter((id): id is number => id !== null);

    return {
      tokens,
      registeredSlotIds,
      onUnregister,
      unregisteringSecret,
    };
  }, [listId, getTokensForList, onUnregister, unregisteringSecret]);
}
