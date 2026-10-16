import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi, { currentSessionGeneration, isCurrentSession } from "../api/userApi";
import { fetchAllPages, LIBRARY_PAGE_SIZE } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
import { guardedReload } from "../utils/guardedReload";
import type { WatchedEntry, WatchedEntryDTO, WatchedInput } from "../types";

function mkKey(id: number, type: string) { return `${type}-${id}`; }

export function useWatched() {
  const { isAuthenticated } = useAuth();
  const [watchedList, setWatchedListState] = useState<WatchedEntry[]>([]);
  // The session generation of the last finished load. Until it's this
  // session's, the collection is loading, so the first render after sign-in
  // never reads as loaded and empty.
  const [loadedGen, setLoadedGen] = useState<number | null>(null);
  const [reloading, setReloading] = useState(false);
  const isLoading = isAuthenticated && (reloading || loadedGen !== currentSessionGeneration());
  // The session generation of the last successful load. A failed reload after
  // one keeps the list (and this), so a page can tell "never loaded" apart
  // from "the last reload failed".
  const [loadedOkGen, setLoadedOkGen] = useState<number | null>(null);
  const hasLoaded = isAuthenticated && loadedOkGen === currentSessionGeneration();
  const [error, setError] = useState<unknown>(null);
  // Bumped as each write settles: a reload that started earlier is rerun.
  const writeSeq = useRef(0);
  const inflight = useRef(createInflight({ onSettle: () => { writeSeq.current += 1; } }));
  const dbIdMap = useRef<Record<string, number>>({});
  const watchedRef = useRef(watchedList);
  // Writes can run queued behind one another (a clear, then an add) before
  // React re-renders, so the ref changes together with the state, not on render.
  const setWatchedList = useCallback((next: WatchedEntry[] | ((prev: WatchedEntry[]) => WatchedEntry[])) => {
    watchedRef.current = typeof next === "function" ? next(watchedRef.current) : next;
    setWatchedListState(watchedRef.current);
  }, []);

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    // A response that lands after sign-out belongs to the previous account.
    const gen = currentSessionGeneration();
    setReloading(true);
    try {
      await guardedReload(
        writeSeq,
        () => fetchAllPages<WatchedEntryDTO>(userApi, "/watched/", { pageSize: LIBRARY_PAGE_SIZE }),
        (data) => {
          if (!isCurrentSession(gen)) return;
          const map: Record<string, number> = {};
          const entries: WatchedEntry[] = data.map((item) => {
            map[mkKey(item.mediaId, item.mediaType)] = item.id;
            return {
              id: item.mediaId,
              type: item.mediaType,
              title: item.title,
              posterPath: item.posterPath,
              voteAverage: item.voteAverage,
              watchedAt: item.watchedAt,
              watchedTz: item.watchedTz ?? "",
              runtimeMinutes: item.runtimeMinutes,
              platform: item.platform,
            };
          });
          dbIdMap.current = map;
          setWatchedList(entries);
          setError(null);
          setLoadedOkGen(gen);
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
  }, [isAuthenticated, setWatchedList]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchedList([]);
      dbIdMap.current = {};
      setError(null);
      setReloading(false);
      return;
    }
    reload().catch(() => { /* recorded in `error` */ });
  }, [isAuthenticated, reload, setWatchedList]);

  const addRaw = useCallback(async (entry: WatchedInput) => {
    if (!isAuthenticated) return;
    if (watchedRef.current.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const gen = currentSessionGeneration();
    const { data } = await userApi.post<WatchedEntryDTO>("/watched/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
      runtimeMinutes: entry.runtimeMinutes,
      platform: entry.platform,
      originalLanguage: entry.originalLanguage,
      releaseYear: entry.releaseYear,
    });
    if (!isCurrentSession(gen)) return;
    dbIdMap.current[mkKey(entry.id, entry.type)] = data.id;
    setWatchedList((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      // Newest first, matching the API order (-watched_at) — Home's Recently
      // Watched strip takes the first 8.
      return [{ ...entry, watchedAt: data.watchedAt, watchedTz: data.watchedTz ?? "" }, ...prev];
    });
  }, [isAuthenticated, setWatchedList]);

  const removeRaw = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[mkKey(id, type)];
    if (dbId == null) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/watched/${dbId}/`);
    if (!isCurrentSession(gen)) return;
    delete dbIdMap.current[mkKey(id, type)];
    setWatchedList((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  }, [isAuthenticated, setWatchedList]);

  const isWatched = useCallback((id: number, type: string): boolean =>
    watchedRef.current.some((i) => i.id === id && i.type === type),
  []);

  // Every write for one title shares an in-flight slot: a double-click settles
  // with the first request, and a different action (unmark while the mark is
  // pending) runs after it with its own outcome.
  const add = useCallback((entry: WatchedInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () => addRaw(entry), "add"),
  [addRaw]);

  const remove = useCallback((id: number, type: string) =>
    inflight.current.run(mkKey(id, type), () => removeRaw(id, type), "remove"),
  [removeRaw]);

  const toggle = useCallback((entry: WatchedInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () =>
      watchedRef.current.some((i) => i.id === entry.id && i.type === entry.type)
        ? removeRaw(entry.id, entry.type)
        : addRaw(entry), "toggle"),
  [removeRaw, addRaw]);

  // Waits for this collection's pending item writes, and writes started
  // meanwhile wait for it, so the screen follows the order the user acted in.
  const clearAll = useCallback(() => inflight.current.runExclusive(async () => {
    if (!isAuthenticated) return;
    const gen = currentSessionGeneration();
    await userApi.delete("/watched/clear/");
    if (!isCurrentSession(gen)) return;
    dbIdMap.current = {};
    setWatchedList([]);
  }), [isAuthenticated, setWatchedList]);

  return { watchedList, isLoading, hasLoaded, error, add, remove, isWatched, toggle, clearAll, reload };
}
