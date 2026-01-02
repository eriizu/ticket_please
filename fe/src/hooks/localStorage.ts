import type { unknown } from "arktype/internal/keywords/ts.ts";
import { useState, useEffect, useCallback, useRef } from "react";

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

    try {
      const item = window.localStorage.getItem(key);
      if (construct) {
        return item ? construct(JSON.parse(item)) : initialValue;
      } else {
        return item ? JSON.parse(item) : initialValue;
      }
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
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
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
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

    // Add the event listener
    window.addEventListener("storage", handleStorageChange);

    // Clean up on unmount
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key, initialValue, construct]);

  return [storedValue, setValue] as const;
}
// Usage in a component:
// const [theme, setTheme] = useLocalStorage("theme", "light");
