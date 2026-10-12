import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi, { currentSessionGeneration, isCurrentSession } from "../api/userApi";
import { fetchAllPages, LIBRARY_PAGE_SIZE } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
import type { WatchlistEntry, WatchlistEntryDTO, WatchlistInput } from "../types";

function mkKey(id: number, type: string) { return `${type}-${id}`; }

export function useWatchlist() {
  const { isAuthenticated } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const [error, setError] = useState<unknown>(null);
  const inflight = useRef(createInflight());
  const dbIdMap = useRef<Record<string, number>>({});
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    // A response that lands after sign-out belongs to the previous account.
    const gen = currentSessionGeneration();
    setIsLoading(true);
    try {
      const data = await fetchAllPages<WatchlistEntryDTO>(userApi, "/watchlist/", { pageSize: LIBRARY_PAGE_SIZE });
      if (!isCurrentSession(gen)) return;
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
        };
      });
      dbIdMap.current = map;
      setWatchlist(entries);
      setError(null);
    } catch (err) {
      if (!isCurrentSession(gen)) return;
      // Keep whatever was already loaded; the page decides how to surface it.
      setError(err);
      throw err;
    } finally {
      if (isCurrentSession(gen)) setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist([]);
      dbIdMap.current = {};
      setError(null);
      setIsLoading(false);
      return;
    }
    reload().catch(() => { /* recorded in `error` */ });
  }, [isAuthenticated, reload]);

  const addRaw = useCallback(async (entry: WatchlistInput) => {
    if (!isAuthenticated) return;
    if (watchlistRef.current.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const gen = currentSessionGeneration();
    const { data } = await userApi.post<WatchlistEntryDTO>("/watchlist/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
    if (!isCurrentSession(gen)) return;
    dbIdMap.current[mkKey(entry.id, entry.type)] = data.id;
    setWatchlist((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      return [...prev, { ...entry, addedAt: data.addedAt }];
    });
  }, [isAuthenticated]);

  const removeRaw = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[mkKey(id, type)];
    if (dbId == null) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/watchlist/${dbId}/`);
    if (!isCurrentSession(gen)) return;
    delete dbIdMap.current[mkKey(id, type)];
    setWatchlist((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  }, [isAuthenticated]);

  const clearAll = useCallback(async () => {
    if (!isAuthenticated) return;
    const gen = currentSessionGeneration();
    await userApi.delete("/watchlist/clear/");
    if (!isCurrentSession(gen)) return;
    dbIdMap.current = {};
    setWatchlist([]);
  }, [isAuthenticated]);

  const isIn = useCallback((id: number, type: string): boolean =>
    watchlistRef.current.some((i) => i.id === id && i.type === type),
  []);

  // Every write for one title shares an in-flight slot, so a double-click (or
  // a remove fired while the add is pending) settles with the first request.
  const add = useCallback((entry: WatchlistInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () => addRaw(entry)),
  [addRaw]);

  const remove = useCallback((id: number, type: string) =>
    inflight.current.run(mkKey(id, type), () => removeRaw(id, type)),
  [removeRaw]);

  const toggle = useCallback((entry: WatchlistInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () =>
      watchlistRef.current.some((i) => i.id === entry.id && i.type === entry.type)
        ? removeRaw(entry.id, entry.type)
        : addRaw(entry)),
  [removeRaw, addRaw]);

  return { watchlist, isLoading, error, add, remove, clearAll, isIn, toggle, reload };
}
