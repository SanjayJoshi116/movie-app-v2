import { useLocalStorage } from "./useLocalStorage";
import type { WatchlistEntry, WatchlistInput } from "../types";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useLocalStorage<WatchlistEntry[]>("cinedb_watchlist", []);

  const add = (entry: WatchlistInput) => {
    setWatchlist((prev) => {
      if (prev.some((item) => item.id === entry.id && item.type === entry.type))
        return prev;
      return [
        ...prev,
        { ...entry, addedAt: new Date().toISOString(), watched: false },
      ];
    });
  };

  const remove = (id: number, type: string) => {
    setWatchlist((prev) =>
      prev.filter((item) => !(item.id === id && item.type === type))
    );
  };

  const isIn = (id: number, type: string): boolean =>
    watchlist.some((item) => item.id === id && item.type === type);

  const toggle = (entry: WatchlistInput) => {
    if (isIn(entry.id, entry.type)) {
      remove(entry.id, entry.type);
    } else {
      add(entry);
    }
  };

  const markWatched = (id: number, type: string, watched: boolean) => {
    setWatchlist((prev) =>
      prev.map((item) =>
        item.id === id && item.type === type ? { ...item, watched } : item
      )
    );
  };

  return { watchlist, add, remove, isIn, toggle, markWatched };
}
