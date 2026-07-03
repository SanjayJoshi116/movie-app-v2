import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
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
      watched: i.watched,
      _itemId: i.id,
    })),
  }));
}

export function useLists() {
  const { isAuthenticated } = useAuth();
  const [lists, setLists] = useState<UserList[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const { data } = await userApi.get<UserListDTO[]>("/lists/");
      setLists(mapListData(data));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) { setLists([]); return; }
    fetchLists();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const createList = useCallback(async (name: string, description: string) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.post<UserListDTO>("/lists/", { name, description });
    setLists((prev) => [
      ...prev,
      { id: data.id, name: data.name, description: data.description, createdAt: data.createdAt, items: [] },
    ]);
  }, [isAuthenticated]);

  const deleteList = useCallback(async (id: number) => {
    if (!isAuthenticated) return;
    await userApi.delete(`/lists/${id}/`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, [isAuthenticated]);

  const addToList = useCallback(async (listId: number, entry: WatchlistInput) => {
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
              watched: false,
              _itemId: data.id,
            },
          ],
        };
      })
    );
  }, [isAuthenticated, lists]);

  const removeFromList = useCallback(async (listId: number, itemId: number, type: string) => {
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
  }, [isAuthenticated, lists]);

  const clearList = useCallback(async (listId: number) => {
    if (!isAuthenticated) return;
    await userApi.delete(`/lists/${listId}/items/clear/`);
    setLists((prev) =>
      prev.map((l) => (l.id !== listId ? l : { ...l, items: [] }))
    );
  }, [isAuthenticated]);

  const isInList = useCallback((listId: number, id: number, type: string): boolean => {
    const list = lists.find((l) => l.id === listId);
    return list ? list.items.some((i) => i.id === id && i.type === type) : false;
  }, [lists]);

  return { lists, isLoading, createList, deleteList, addToList, removeFromList, clearList, isInList, reloadLists: fetchLists };
}
