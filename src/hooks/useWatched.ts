import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import { fetchAllPages } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
import type { WatchedEntry, WatchedEntryDTO, WatchedInput } from "../types";

function mkKey(id: number, type: string) { return `${type}-${id}`; }

export function useWatched() {
  const { isAuthenticated } = useAuth();
  const [watchedList, setWatchedList] = useState<WatchedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const [error, setError] = useState<unknown>(null);
  const inflight = useRef(createInflight());
  const dbIdMap = useRef<Record<string, number>>({});
  const watchedRef = useRef(watchedList);
  watchedRef.current = watchedList;

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const data = await fetchAllPages<WatchedEntryDTO>(userApi, "/watched/");
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
          runtimeMinutes: item.runtimeMinutes,
          platform: item.platform,
        };
      });
      dbIdMap.current = map;
      setWatchedList(entries);
      setError(null);
    } catch (err) {
      // Keep whatever was already loaded; the page decides how to surface it.
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchedList([]);
      dbIdMap.current = {};
      setError(null);
      setIsLoading(false);
      return;
    }
    reload().catch(() => { /* recorded in `error` */ });
  }, [isAuthenticated, reload]);

  const addRaw = useCallback(async (entry: WatchedInput) => {
    if (!isAuthenticated) return;
    if (watchedRef.current.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const { data } = await userApi.post<WatchedEntryDTO>("/watched/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
      runtimeMinutes: entry.runtimeMinutes,
      platform: entry.platform,
    });
    dbIdMap.current[mkKey(entry.id, entry.type)] = data.id;
    setWatchedList((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      return [...prev, { ...entry, watchedAt: data.watchedAt }];
    });
  }, [isAuthenticated]);

  const removeRaw = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[mkKey(id, type)];
    if (dbId == null) return;
    await userApi.delete(`/watched/${dbId}/`);
    delete dbIdMap.current[mkKey(id, type)];
    setWatchedList((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  }, [isAuthenticated]);

  const isWatched = useCallback((id: number, type: string): boolean =>
    watchedRef.current.some((i) => i.id === id && i.type === type),
  []);

  // Every write for one title shares an in-flight slot, so a double-click (or
  // a remove fired while the add is pending) settles with the first request.
  const add = useCallback((entry: WatchedInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () => addRaw(entry)),
  [addRaw]);

  const remove = useCallback((id: number, type: string) =>
    inflight.current.run(mkKey(id, type), () => removeRaw(id, type)),
  [removeRaw]);

  const toggle = useCallback((entry: WatchedInput) =>
    inflight.current.run(mkKey(entry.id, entry.type), () =>
      watchedRef.current.some((i) => i.id === entry.id && i.type === entry.type)
        ? removeRaw(entry.id, entry.type)
        : addRaw(entry)),
  [removeRaw, addRaw]);

  const clearAll = useCallback(async () => {
    if (!isAuthenticated) return;
    await userApi.delete("/watched/clear/");
    dbIdMap.current = {};
    setWatchedList([]);
  }, [isAuthenticated]);

  return { watchedList, isLoading, error, add, remove, isWatched, toggle, clearAll, reload };
}
