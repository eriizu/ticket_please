import { useCallback, useEffect, useState } from "react";

const CUSTOM_STORAGE_EVENT = "local-storage-update";
type CustomStorageEvent = CustomEvent<{ key: string; newValue: string }>;

declare global {
  interface WindowEventMap {
    "local-storage-update": CustomStorageEvent;
  }
}

export function getFromLocalStorage<T>(
  key: string,
  construct: ((raw: unknown) => T) | null,
): T | undefined {
  try {
    const item = window.localStorage.getItem(key);
    if (construct) {
      return item ? construct(JSON.parse(item)) : undefined;
    } else {
      return item ? JSON.parse(item) : undefined;
    }
  } catch (error) {
    console.warn(`Error reading localStorage key “${key}”:`, error);
    return undefined;
  }
}

/**
 * A hook to manage localStorage with multi-tab synchronization.
 * @param key The key to store in localStorage.
 * @param initialValue The default value if nothing is found in storage.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  construct: ((raw: unknown) => T) | null,
) {
  // 1. Get the initial value
  // We use a functional initializer for useState so this only runs once on mount
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    return getFromLocalStorage(key, construct) || initialValue;
  });

  // 2. Wrap the setter function
  // This ensures that whenever we call setValue, localStorage is also updated
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Save state
        setStoredValue(valueToStore);

        // Save to local storage
        const stringifiedValue = JSON.stringify(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, stringifiedValue);
          window.dispatchEvent(
            new CustomEvent(CUSTOM_STORAGE_EVENT, {
              detail: { key, newValue: stringifiedValue },
            }),
          );
        }
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key, storedValue],
  );

  // 3. Listen for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // If the event key matches our key and was triggered by another tab
      if (event.key === key && event.storageArea === localStorage) {
        try {
          const newValue = event.newValue
            ? JSON.parse(event.newValue)
            : initialValue;
          if (construct) {
            setStoredValue(construct(newValue));
          } else {
            setStoredValue(newValue);
          }
        } catch (error) {
          console.error(`Error parsing sync data for “${key}”:`, error);
        }
      }
    };

    const handleCustomEvent = (event: CustomStorageEvent) => {
      if (event.type === CUSTOM_STORAGE_EVENT) {
        if (event.detail.key !== key) return;
        try {
          const raw = JSON.parse(event.detail.newValue);
          if (construct) {
            setStoredValue(construct(raw));
          } else {
            setStoredValue(raw);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    // Add the event listener
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(CUSTOM_STORAGE_EVENT, handleCustomEvent);

    // Clean up on unmount
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(CUSTOM_STORAGE_EVENT, handleCustomEvent);
    };
  }, [key, initialValue, construct]);

  return [storedValue, setValue] as const;
}
