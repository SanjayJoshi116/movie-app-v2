import { useLocalStorage } from "./useLocalStorage";
import type { UserList, WatchlistInput } from "../types";

export function useLists() {
  const [lists, setLists] = useLocalStorage<UserList[]>("cinedb_lists", []);

  const createList = (name: string, description: string) => {
    const newList: UserList = {
      id: crypto.randomUUID(),
      name,
      description,
      items: [],
      createdAt: new Date().toISOString(),
    };
    setLists((prev) => [...prev, newList]);
  };

  const deleteList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const addToList = (listId: string, entry: WatchlistInput) => {
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        const alreadyIn = l.items.some((i) => i.id === entry.id && i.type === entry.type);
        if (alreadyIn) return l;
        return {
          ...l,
          items: [
            ...l.items,
            { ...entry, addedAt: new Date().toISOString(), watched: false },
          ],
        };
      })
    );
  };

  const removeFromList = (listId: string, itemId: number, type: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id !== listId
          ? l
          : { ...l, items: l.items.filter((i) => !(i.id === itemId && i.type === type)) }
      )
    );
  };

  const isInList = (listId: string, id: number, type: string): boolean => {
    const list = lists.find((l) => l.id === listId);
    return list ? list.items.some((i) => i.id === id && i.type === type) : false;
  };

  return { lists, createList, deleteList, addToList, removeFromList, isInList };
}
