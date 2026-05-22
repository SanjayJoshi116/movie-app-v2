import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { UserList, WatchlistInput } from "../types";

export function useLists() {
  const { isAuthenticated } = useAuth();
  const [lists, setLists] = useState<UserList[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLists([]);
      return;
    }
    setIsLoading(true);
    userApi
      .get("/lists/")
      .then(({ data }) => {
        setLists(
          data.map((l: any) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            createdAt: l.createdAt,
            items: l.items.map((i: any) => ({
              id: i.mediaId,
              type: i.mediaType,
              title: i.title,
              posterPath: i.posterPath,
              voteAverage: i.voteAverage,
              addedAt: i.addedAt,
              watched: i.watched,
              _itemId: i.id,
            })),
          }))
        );
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const createList = async (name: string, description: string) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.post("/lists/", { name, description });
    setLists((prev) => [
      ...prev,
      { id: data.id, name: data.name, description: data.description, createdAt: data.createdAt, items: [] },
    ]);
  };

  const deleteList = async (id: number) => {
    if (!isAuthenticated) return;
    await userApi.delete(`/lists/${id}/`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const addToList = async (listId: number, entry: WatchlistInput) => {
    if (!isAuthenticated) return;
    const list = lists.find((l) => l.id === listId);
    if (list?.items.some((i) => i.id === entry.id && i.type === entry.type)) return;
    const { data } = await userApi.post(`/lists/${listId}/items/`, {
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
  };

  const removeFromList = async (listId: number, itemId: number, type: string) => {
    if (!isAuthenticated) return;
    const list = lists.find((l) => l.id === listId);
    const item = list?.items.find((i) => i.id === itemId && i.type === type) as any;
    if (!item?._itemId) return;
    await userApi.delete(`/lists/${listId}/items/${item._itemId}/`);
    setLists((prev) =>
      prev.map((l) =>
        l.id !== listId
          ? l
          : { ...l, items: l.items.filter((i) => !(i.id === itemId && i.type === type)) }
      )
    );
  };

  const isInList = (listId: number, id: number, type: string): boolean => {
    const list = lists.find((l) => l.id === listId);
    return list ? list.items.some((i) => i.id === id && i.type === type) : false;
  };

  return { lists, isLoading, createList, deleteList, addToList, removeFromList, isInList };
}
