import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { WatchlistEntry, WatchlistEntryDTO, WatchlistInput } from "../types";

function mkKey(id: number, type: string) { return `${type}-${id}`; }

export function useWatchlist() {
  const { isAuthenticated } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dbIdMap = useRef<Record<string, number>>({});
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist([]);
      dbIdMap.current = {};
      return;
    }
    setIsLoading(true);
    userApi
      .get<WatchlistEntryDTO[]>("/watchlist/")
      .then(({ data }) => {
        const map: Record<string, number> = {};
        const entries: WatchlistEntry[] = data.map((item) => {
          map[mkKey(item.mediaId, item.mediaType)] = item.id;
          return {
            id: item.mediaId,
            type: item.mediaType,
            title: item.title,
            posterPath: item.posterPath,
            voteAverage: item.voteAverage,
            addedAt: item.addedAt,
            watched: item.watched,
          };
        });
        dbIdMap.current = map;
        setWatchlist(entries);
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const add = useCallback(async (entry: WatchlistInput) => {
    if (!isAuthenticated) return;
    if (watchlistRef.current.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const { data } = await userApi.post<WatchlistEntryDTO>("/watchlist/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
    dbIdMap.current[mkKey(entry.id, entry.type)] = data.id;
    setWatchlist((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      return [...prev, { ...entry, addedAt: data.addedAt, watched: false }];
    });
  }, [isAuthenticated]);

  const remove = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[mkKey(id, type)];
    if (dbId == null) return;
    await userApi.delete(`/watchlist/${dbId}/`);
    delete dbIdMap.current[mkKey(id, type)];
    setWatchlist((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  }, [isAuthenticated]);

  const clearAll = useCallback(async () => {
    if (!isAuthenticated) return;
    await userApi.delete("/watchlist/clear/");
    dbIdMap.current = {};
    setWatchlist([]);
  }, [isAuthenticated]);

  const isIn = useCallback((id: number, type: string): boolean =>
    watchlistRef.current.some((i) => i.id === id && i.type === type),
  []);

  const toggle = useCallback(async (entry: WatchlistInput) => {
    if (watchlistRef.current.some((i) => i.id === entry.id && i.type === entry.type)) {
      await remove(entry.id, entry.type);
    } else {
      await add(entry);
    }
  }, [remove, add]);

  const markWatched = useCallback(async (id: number, type: string, watched: boolean) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[mkKey(id, type)];
    if (dbId == null) return;
    await userApi.patch(`/watchlist/${dbId}/`, { watched });
    setWatchlist((prev) =>
      prev.map((i) => (i.id === id && i.type === type ? { ...i, watched } : i))
    );
  }, [isAuthenticated]);

  return { watchlist, isLoading, add, remove, clearAll, isIn, toggle, markWatched };
}
