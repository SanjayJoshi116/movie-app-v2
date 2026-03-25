import { useContext } from "react";
import { AppContext } from "./AppContext";
import type { AppContextType } from "../types";

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (ctx === null)
    throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
