import React, { createContext, ReactNode } from "react";
import { useLists } from "../hooks/useLists";
import type { ListsContextType } from "../types";

export const ListsContext = createContext<ListsContextType | null>(null);

export function ListsProvider({ children }: { children: ReactNode }) {
  const { lists, createList, deleteList, addToList, removeFromList, isInList } = useLists();

  const value: ListsContextType = {
    lists,
    createList,
    deleteList,
    addToList,
    removeFromList,
    isInList,
  };

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}
