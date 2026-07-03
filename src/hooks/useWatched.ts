import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { WatchedEntry, WatchedEntryDTO, WatchedInput } from "../types";

function mkKey(id: number, type: string) { return `${type}-${id}`; }

export function useWatched() {
  const { isAuthenticated } = useAuth();
  const [watchedList, setWatchedList] = useState<WatchedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dbIdMap = useRef<Record<string, number>>({});
  const watchedRef = useRef(watchedList);
  watchedRef.current = watchedList;

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchedList([]);
      dbIdMap.current = {};
      return;
    }
    setIsLoading(true);
    userApi
      .get<WatchedEntryDTO[]>("/watched/")
      .then(({ data }) => {
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
          };
        });
        dbIdMap.current = map;
        setWatchedList(entries);
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const add = useCallback(async (entry: WatchedInput) => {
    if (!isAuthenticated) return;
    if (watchedRef.current.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const { data } = await userApi.post<WatchedEntryDTO>("/watched/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
    dbIdMap.current[mkKey(entry.id, entry.type)] = data.id;
    setWatchedList((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      return [...prev, { ...entry, watchedAt: data.watchedAt }];
    });
  }, [isAuthenticated]);

  const remove = useCallback(async (id: number, type: string) => {
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

  const toggle = useCallback(async (entry: WatchedInput) => {
    if (watchedRef.current.some((i) => i.id === entry.id && i.type === entry.type)) {
      await remove(entry.id, entry.type);
    } else {
      await add(entry);
    }
  }, [remove, add]);

  const clearAll = useCallback(async () => {
    if (!isAuthenticated) return;
    await userApi.delete("/watched/clear/");
    dbIdMap.current = {};
    setWatchedList([]);
  }, [isAuthenticated]);

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    const { data } = await userApi.get<WatchedEntryDTO[]>("/watched/");
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
      };
    });
    dbIdMap.current = map;
    setWatchedList(entries);
  }, [isAuthenticated]);

  return { watchedList, isLoading, add, remove, isWatched, toggle, clearAll, reload };
}
