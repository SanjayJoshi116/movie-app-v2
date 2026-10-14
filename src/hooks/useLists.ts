import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import userApi, { currentSessionGeneration, isCurrentSession } from "../api/userApi";
import { fetchAllPages } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
import { guardedReload } from "../utils/guardedReload";
import type { UserList, UserListDTO, UserListItemDTO, WatchlistInput } from "../types";

function mapListData(data: UserListDTO[]): UserList[] {
  return data.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    createdAt: l.createdAt,
    items: l.items.map((i) => ({
      id: i.mediaId,
      type: i.mediaType,
      title: i.title,
      posterPath: i.posterPath,
      voteAverage: i.voteAverage,
      addedAt: i.addedAt,
      _itemId: i.id,
    })),
  }));
}

export function useLists() {
  const { isAuthenticated } = useAuth();
  const [lists, setListsState] = useState<UserList[]>([]);
  // The session generation of the last finished load. Until it's this
  // session's, lists are loading, so the first render after sign-in never
  // reads as loaded and empty.
  const [loadedGen, setLoadedGen] = useState<number | null>(null);
  const [reloading, setReloading] = useState(false);
  const isLoading = isAuthenticated && (reloading || loadedGen !== currentSessionGeneration());
  const [error, setError] = useState<unknown>(null);
  // Bumped as each write settles: a reload that started earlier is rerun.
  const writeSeq = useRef(0);
  // Each list's item writes, clear, delete and edits share one group, so a
  // clear or delete is ordered with that list's item writes only.
  const inflight = useRef(createInflight({ onSettle: () => { writeSeq.current += 1; } }));
  // Item writes can be queued behind a clear: read the lists as they are when
  // the write runs, not as they were when it was clicked. The ref changes
  // together with the state, because a queued write runs before React re-renders.
  const listsRef = useRef(lists);
  const setLists = useCallback((next: UserList[] | ((prev: UserList[]) => UserList[])) => {
    listsRef.current = typeof next === "function" ? next(listsRef.current) : next;
    setListsState(listsRef.current);
  }, []);

  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) return;
    // A response that lands after sign-out belongs to the previous account.
    const gen = currentSessionGeneration();
    setReloading(true);
    try {
      await guardedReload(
        writeSeq,
        () => fetchAllPages<UserListDTO>(userApi, "/lists/"),
        (data) => {
          if (!isCurrentSession(gen)) return;
          setLists(mapListData(data));
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
  }, [isAuthenticated, setLists]);

  useEffect(() => {
    if (!isAuthenticated) { setLists([]); setError(null); setReloading(false); return; }
    fetchLists().catch(() => { /* recorded in `error` */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Keyed by the normalized name: a double-click (or double Enter) on "create"
  // gets the first request's result instead of making a second, identical list.
  // `createdAt` only from a backup restore: the server keeps the original time.
  const createList = useCallback((name: string, description: string, createdAt?: string): Promise<UserList | undefined> =>
    inflight.current.run(`create-${name.trim().toLowerCase()}`, async () => {
      if (!isAuthenticated) return undefined;
      const gen = currentSessionGeneration();
      const { data } = await userApi.post<UserListDTO>("/lists/", { name, description, ...(createdAt ? { createdAt } : {}) });
      if (!isCurrentSession(gen)) return undefined;
      const created: UserList = { id: data.id, name: data.name, description: data.description, createdAt: data.createdAt, items: [] };
      // Newest first, like the API (-created_at), so a reload doesn't move it.
      setLists((prev) => [created, ...prev]);
      return created;
    }), [isAuthenticated, setLists]);

  const deleteList = useCallback((id: number) => inflight.current.group(id).runExclusive(async () => {
    if (!isAuthenticated) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/lists/${id}/`);
    if (!isCurrentSession(gen)) return;
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, "delete"), [isAuthenticated, setLists]);

  // In the list's group: waits for a pending clear or delete of that list.
  const updateList = useCallback((id: number, patch: { name?: string; description?: string }) =>
    inflight.current.group(id).run("details", async () => {
      if (!isAuthenticated) return;
      const gen = currentSessionGeneration();
      const { data } = await userApi.patch<UserListDTO>(`/lists/${id}/`, patch);
      if (!isCurrentSession(gen)) return;
      setLists((prev) => prev.map((l) => (l.id !== id ? l : { ...l, name: data.name, description: data.description })));
    }, `update:${JSON.stringify(patch)}`), [isAuthenticated, setLists]);

  const addToList = useCallback((listId: number, entry: WatchlistInput) =>
    inflight.current.group(listId).run(`${entry.type}-${entry.id}`, async () => {
    if (!isAuthenticated) return;
    const list = listsRef.current.find((l) => l.id === listId);
    if (list?.items.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const gen = currentSessionGeneration();
    const { data } = await userApi.post<UserListItemDTO>(`/lists/${listId}/items/`, {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
    if (!isCurrentSession(gen)) return;
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        const alreadyIn = l.items.some((i) => i.id === entry.id && i.type === entry.type);
        if (alreadyIn) return l;
        return {
          ...l,
          items: [
            ...l.items,
            {
              id: entry.id,
              type: entry.type,
              title: entry.title,
              posterPath: entry.posterPath,
              voteAverage: entry.voteAverage,
              addedAt: data.addedAt,
              _itemId: data.id,
            },
          ],
        };
      })
    );
  }, "add"), [isAuthenticated, setLists]);

  const removeFromList = useCallback((listId: number, itemId: number, type: string) =>
    inflight.current.group(listId).run(`${type}-${itemId}`, async () => {
    if (!isAuthenticated) return;
    const list = listsRef.current.find((l) => l.id === listId);
    const item = list?.items.find((i) => i.id === itemId && i.type === type) as { _itemId?: number } | undefined;
    if (!item?._itemId) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/lists/${listId}/items/${item._itemId}/`);
    if (!isCurrentSession(gen)) return;
    setLists((prev) =>
      prev.map((l) =>
        l.id !== listId
          ? l
          : { ...l, items: l.items.filter((i) => !(i.id === itemId && i.type === type)) }
      )
    );
  }, "remove"), [isAuthenticated, setLists]);

  // Waits for the list's pending item writes, and item writes started
  // meanwhile wait for it, so the list follows the order the user acted in.
  const clearList = useCallback((listId: number) => inflight.current.group(listId).runExclusive(async () => {
    if (!isAuthenticated) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/lists/${listId}/items/clear/`);
    if (!isCurrentSession(gen)) return;
    setLists((prev) =>
      prev.map((l) => (l.id !== listId ? l : { ...l, items: [] }))
    );
  }, "clear"), [isAuthenticated, setLists]);

  const isInList = useCallback((listId: number, id: number, type: string): boolean => {
    const list = lists.find((l) => l.id === listId);
    return list ? list.items.some((i) => i.id === id && i.type === type) : false;
  }, [lists]);

  return { lists, isLoading, error, createList, deleteList, updateList, addToList, removeFromList, clearList, isInList, reloadLists: fetchLists };
}
