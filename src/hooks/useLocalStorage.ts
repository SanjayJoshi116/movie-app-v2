import { useCallback, useEffect, useRef, useState } from "react";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

/** Same-tab change notice: `storage` events only reach *other* tabs. */
const SAME_TAB_EVENT = "cinedb-local-storage";
type SameTabDetail = { key: string; raw: string; source: object };

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  // Latest value, so back-to-back updater calls chain, and so the write and
  // the same-tab notice happen once, outside React's (StrictMode
  // double-invoked) state updater.
  const latestRef = useRef(storedValue);
  // Identifies this instance, so it skips its own same-tab notice.
  const sourceRef = useRef({});

  // Sync across tabs (`storage`) and across instances in this tab (e.g. the
  // Sidebar and BottomNav search boxes both reading recent searches).
  useEffect(() => {
    const adopt = (raw: string | null) => {
      try {
        const next = raw !== null ? (JSON.parse(raw) as T) : initialValue;
        latestRef.current = next;
        setStoredValue(next);
      } catch {
        // ignore malformed data written elsewhere
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) adopt(e.newValue);
    };
    const onSameTab = (e: Event) => {
      const detail = (e as CustomEvent<SameTabDetail>).detail;
      if (detail.key === key && detail.source !== sourceRef.current) adopt(detail.raw);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onSameTab);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Stable: it reads only refs and `key`, so consumers' memos and effects
  // that depend on it (UIContext's value, toggleTheme) don't change each render.
  const setValue: SetValue<T> = useCallback((value) => {
    const next = value instanceof Function ? value(latestRef.current) : value;
    latestRef.current = next;
    setStoredValue(next);
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(key, raw);
    } catch (err) {
      console.error(`useLocalStorage: failed to set "${key}"`, err);
    }
    window.dispatchEvent(new CustomEvent<SameTabDetail>(SAME_TAB_EVENT, { detail: { key, raw, source: sourceRef.current } }));
  }, [key]);

  return [storedValue, setValue];
}
