import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import { fetchAllPages } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
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
  const [lists, setLists] = useState<UserList[]>([]);
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const [error, setError] = useState<unknown>(null);
  const inflight = useRef(createInflight());

  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const data = await fetchAllPages<UserListDTO>(userApi, "/lists/");
      setLists(mapListData(data));
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
    if (!isAuthenticated) { setLists([]); setError(null); setIsLoading(false); return; }
    fetchLists().catch(() => { /* recorded in `error` */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const createList = useCallback(async (name: string, description: string): Promise<UserList | undefined> => {
    if (!isAuthenticated) return undefined;
    const { data } = await userApi.post<UserListDTO>("/lists/", { name, description });
    const created: UserList = { id: data.id, name: data.name, description: data.description, createdAt: data.createdAt, items: [] };
    setLists((prev) => [...prev, created]);
    return created;
  }, [isAuthenticated]);

  const deleteList = useCallback((id: number) => inflight.current.run(`list-${id}`, async () => {
    if (!isAuthenticated) return;
    await userApi.delete(`/lists/${id}/`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }), [isAuthenticated]);

  const updateList = useCallback(async (id: number, patch: { name?: string; description?: string }) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.patch<UserListDTO>(`/lists/${id}/`, patch);
    setLists((prev) => prev.map((l) => (l.id !== id ? l : { ...l, name: data.name, description: data.description })));
  }, [isAuthenticated]);

  const addToList = useCallback((listId: number, entry: WatchlistInput) =>
    inflight.current.run(`${listId}-${entry.type}-${entry.id}`, async () => {
    if (!isAuthenticated) return;
    const list = lists.find((l) => l.id === listId);
    if (list?.items.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const { data } = await userApi.post<UserListItemDTO>(`/lists/${listId}/items/`, {
      mediaId: entry.id,
      mediaType: entry.type,
      title: entry.title,
      posterPath: entry.posterPath,
      voteAverage: entry.voteAverage,
    });
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
  }), [isAuthenticated, lists]);

  const removeFromList = useCallback((listId: number, itemId: number, type: string) =>
    inflight.current.run(`${listId}-${type}-${itemId}`, async () => {
    if (!isAuthenticated) return;
    const list = lists.find((l) => l.id === listId);
    const item = list?.items.find((i) => i.id === itemId && i.type === type) as { _itemId?: number } | undefined;
    if (!item?._itemId) return;
    await userApi.delete(`/lists/${listId}/items/${item._itemId}/`);
    setLists((prev) =>
      prev.map((l) =>
        l.id !== listId
          ? l
          : { ...l, items: l.items.filter((i) => !(i.id === itemId && i.type === type)) }
      )
    );
  }), [isAuthenticated, lists]);

  const clearList = useCallback((listId: number) => inflight.current.run(`list-${listId}`, async () => {
    if (!isAuthenticated) return;
    await userApi.delete(`/lists/${listId}/items/clear/`);
    setLists((prev) =>
      prev.map((l) => (l.id !== listId ? l : { ...l, items: [] }))
    );
  }), [isAuthenticated]);

  const isInList = useCallback((listId: number, id: number, type: string): boolean => {
    const list = lists.find((l) => l.id === listId);
    return list ? list.items.some((i) => i.id === id && i.type === type) : false;
  }, [lists]);

  return { lists, isLoading, error, createList, deleteList, updateList, addToList, removeFromList, clearList, isInList, reloadLists: fetchLists };
}
