import { useContext } from "react";
import { ListsContext } from "./ListsContext";
import type { ListsContextType } from "../types";

export function useListsContext(): ListsContextType {
  const ctx = useContext(ListsContext);
  if (ctx === null)
    throw new Error("useListsContext must be used within ListsProvider");
  return ctx;
}
