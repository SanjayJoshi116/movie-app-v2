import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { WatchlistEntry, WatchlistInput } from "../types";

export function useWatchlist() {
  const { isAuthenticated } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dbIdMap = useRef<Record<string, number>>({});

  const key = (id: number, type: string) => `${type}-${id}`;

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist([]);
      dbIdMap.current = {};
      return;
    }
    setIsLoading(true);
    userApi
      .get("/watchlist/")
      .then(({ data }) => {
        const map: Record<string, number> = {};
        const entries: WatchlistEntry[] = data.map((item: any) => {
          map[key(item.mediaId, item.mediaType)] = item.id;
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

  const add = async (entry: WatchlistInput) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.post("/watchlist/", {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
    dbIdMap.current[key(entry.id, entry.type)] = data.id;
    setWatchlist((prev) => {
      if (prev.some((i) => i.id === entry.id && i.type === entry.type)) return prev;
      return [
        ...prev,
        { ...entry, addedAt: data.addedAt, watched: false },
      ];
    });
  };

  const remove = async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[key(id, type)];
    if (dbId == null) return;
    await userApi.delete(`/watchlist/${dbId}/`);
    delete dbIdMap.current[key(id, type)];
    setWatchlist((prev) => prev.filter((i) => !(i.id === id && i.type === type)));
  };

  const isIn = (id: number, type: string): boolean =>
    watchlist.some((i) => i.id === id && i.type === type);

  const toggle = async (entry: WatchlistInput) => {
    if (isIn(entry.id, entry.type)) {
      await remove(entry.id, entry.type);
    } else {
      await add(entry);
    }
  };

  const markWatched = async (id: number, type: string, watched: boolean) => {
    if (!isAuthenticated) return;
    const dbId = dbIdMap.current[key(id, type)];
    if (dbId == null) return;
    await userApi.patch(`/watchlist/${dbId}/`, { watched });
    setWatchlist((prev) =>
      prev.map((i) => (i.id === id && i.type === type ? { ...i, watched } : i))
    );
  };

  return { watchlist, isLoading, add, remove, isIn, toggle, markWatched };
}
