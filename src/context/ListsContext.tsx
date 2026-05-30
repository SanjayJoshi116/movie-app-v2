import React, { createContext, ReactNode } from "react";
import { useLists } from "../hooks/useLists";
import type { ListsContextType } from "../types";

export const ListsContext = createContext<ListsContextType | null>(null);

export function ListsProvider({ children }: { children: ReactNode }) {
  const { lists, isLoading, createList, deleteList, addToList, removeFromList, clearList, isInList, reloadLists } = useLists();

  const value: ListsContextType = {
    lists,
    isLoading,
    createList,
    deleteList,
    addToList,
    removeFromList,
    clearList,
    isInList,
    reloadLists,
  };

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}
