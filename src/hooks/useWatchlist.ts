import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi, { currentSessionGeneration, isCurrentSession } from "../api/userApi";
import { fetchAllPages, LIBRARY_PAGE_SIZE } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
import { guardedReload } from "../utils/guardedReload";
import type { WatchlistEntry, WatchlistEntryDTO, WatchlistInput } from "../types";

function mkKey(id: number, type: string) { return `${type}-${id}`; }

export function useWatchlist() {
  const { isAuthenticated } = useAuth();
  const [watchlist, setWatchlistState] = useState<WatchlistEntry[]>([]);
  // The session generation of the last finished load. Until it's this
  // session's, the collection is loading, so the first render after sign-in
  // never reads as loaded and empty.
  const [loadedGen, setLoadedGen] = useState<number | null>(null);
  const [reloading, setReloading] = useState(false);
  const isLoading = isAuthenticated && (reloading || loadedGen !== currentSessionGeneration());
  const [error, setError] = useState<unknown>(null);
  // Bumped as each write settles: a reload that started earlier is rerun.
  const writeSeq = useRef(0);
  const inflight = useRef(createInflight({ onSettle: () => { writeSeq.current += 1; } }));
  const dbIdMap = useRef<Record<string, number>>({});
  const watchlistRef = useRef(watchlist);
  // Writes can run queued behind one another (a clear, then an add) before
  // React re-renders, so the ref changes together with the state, not on render.
  const setWatchlist = useCallback((next: WatchlistEntry[] | ((prev: WatchlistEntry[]) => WatchlistEntry[])) => {
    watchlistRef.current = typeof next === "function" ? next(watchlistRef.current) : next;
    setWatchlistState(watchlistRef.current);
  }, []);

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    // A response that lands after sign-out belongs to the previous account.
    const gen = currentSessionGeneration();
    setReloading(true);
    try {
      await guardedReload(
        writeSeq,
        () => fetchAllPages<WatchlistEntryDTO>(userApi, "/watchlist/", { pageSize: LIBRARY_PAGE_SIZE }),
        (data) => {
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
        },
      );
    } catch (err) {
      if (!isCurrentSession(gen)) return;
      // Keep whatever was already loaded; the page decides how to surface it.
      setError(err);
      throw err;
    } finally {
      if (isCurrentSession(gen)) {
        setReloading(false);
        setLoadedGen(gen);
      }
    }
  }, [isAuthenticated, setWatchlist]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist([]);
      dbIdMap.current = {};
      setError(null);
      setReloading(false);
      return;
    }
    reload().catch(() => { /* recorded in `error` */ });
  }, [isAuthenticated, reload, setWatchlist]);

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
  }, [isAuthenticated, setWatchlist]);

  const removeRaw = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[mkKey(id, type)];
    if (dbId == null) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/watchlist/${dbId}/`);
    if (!isCurrentSession(gen)) return;
    delete dbIdMap.current[mkKey(id, type)];
    setWatchlist((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  }, [isAuthenticated, setWatchlist]);

  // Waits for this collection's pending item writes, and writes started
  // meanwhile wait for it, so the screen follows the order the user acted in.
  const clearAll = useCallback(() => inflight.current.runExclusive(async () => {
    if (!isAuthenticated) return;
    const gen = currentSessionGeneration();
    await userApi.delete("/watchlist/clear/");
    if (!isCurrentSession(gen)) return;
    dbIdMap.current = {};
    setWatchlist([]);
  }), [isAuthenticated, setWatchlist]);

  const isIn = useCallback((id: number, type: string): boolean =>
    watchlistRef.current.some((i) => i.id === id && i.type === type),
  []);

  // Every write for one title shares an in-flight slot: a double-click settles
  // with the first request, and a different action (unmark while the mark is
  // pending) runs after it with its own outcome.
  const add = useCallback((entry: WatchlistInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () => addRaw(entry), "add"),
  [addRaw]);

  const remove = useCallback((id: number, type: string) =>
    inflight.current.run(mkKey(id, type), () => removeRaw(id, type), "remove"),
  [removeRaw]);

  const toggle = useCallback((entry: WatchlistInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () =>
      watchlistRef.current.some((i) => i.id === entry.id && i.type === entry.type)
        ? removeRaw(entry.id, entry.type)
        : addRaw(entry), "toggle"),
  [removeRaw, addRaw]);

  return { watchlist, isLoading, error, add, remove, clearAll, isIn, toggle, reload };
}
