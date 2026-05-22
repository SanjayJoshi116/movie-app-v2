import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { WatchedEntry, WatchedInput } from "../types";

export function useWatched() {
  const { isAuthenticated } = useAuth();
  const [watchedList, setWatchedList] = useState<WatchedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dbIdMap = useRef<Record<string, number>>({});

  const key = (id: number, type: string) => `${type}-${id}`;

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchedList([]);
      dbIdMap.current = {};
      return;
    }
    setIsLoading(true);
    userApi
      .get("/watched/")
      .then(({ data }) => {
        const map: Record<string, number> = {};
        const entries: WatchedEntry[] = data.map((item: any) => {
          map[key(item.mediaId, item.mediaType)] = item.id;
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

  const add = async (entry: WatchedInput) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.post("/watched/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
    dbIdMap.current[key(entry.id, entry.type)] = data.id;
    setWatchedList((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      return [...prev, { ...entry, watchedAt: data.watchedAt }];
    });
  };

  const remove = async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[key(id, type)];
    if (dbId == null) return;
    await userApi.delete(`/watched/${dbId}/`);
    delete dbIdMap.current[key(id, type)];
    setWatchedList((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  };

  const isWatched = (id: number, type: string): boolean =>
    watchedList.some((i) => i.id === id && i.type === type);

  const toggle = async (entry: WatchedInput) => {
    if (isWatched(entry.id, entry.type)) {
      await remove(entry.id, entry.type);
    } else {
      await add(entry);
    }
  };

  const clearAll = async () => {
    if (!isAuthenticated) return;
    await userApi.delete("/watched/clear/");
    dbIdMap.current = {};
    setWatchedList([]);
  };

  const reload = async () => {
    if (!isAuthenticated) return;
    const { data } = await userApi.get("/watched/");
    const map: Record<string, number> = {};
    const entries: WatchedEntry[] = data.map((item: any) => {
      map[key(item.mediaId, item.mediaType)] = item.id;
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
  };

  return { watchedList, isLoading, add, remove, isWatched, toggle, clearAll, reload };
}
