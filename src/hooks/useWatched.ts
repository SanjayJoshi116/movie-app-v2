import { useLocalStorage } from "./useLocalStorage";
import type { WatchedEntry, WatchedInput } from "../types";

export function useWatched() {
  const [watchedList, setWatchedList] = useLocalStorage<WatchedEntry[]>("cinedb_watched", []);

  const add = (entry: WatchedInput) => {
    setWatchedList((prev) => {
      if (prev.some((item) => item.id === entry.id && item.type === entry.type))
        return prev;
      return [...prev, { ...entry, watchedAt: new Date().toISOString() }];
    });
  };

  const remove = (id: number, type: string) => {
    setWatchedList((prev) =>
      prev.filter((item) => !(item.id === id && item.type === type))
    );
  };

  const isWatched = (id: number, type: string): boolean =>
    watchedList.some((item) => item.id === id && item.type === type);

  const toggle = (entry: WatchedInput) => {
    if (isWatched(entry.id, entry.type)) {
      remove(entry.id, entry.type);
    } else {
      add(entry);
    }
  };

  return { watchedList, add, remove, isWatched, toggle };
}
