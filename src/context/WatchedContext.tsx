import { createContext, useContext, useMemo, ReactNode } from "react";
import { useWatched } from "../hooks/useWatched";

type WatchedContextType = ReturnType<typeof useWatched>;

export const WatchedContext = createContext<WatchedContextType | null>(null);

export function WatchedProvider({ children }: { children: ReactNode }) {
  const { watchedList, isLoading, add, remove, isWatched, toggle, clearAll, reload } = useWatched();

  const value = useMemo<WatchedContextType>(() => ({
    watchedList, isLoading, add, remove, isWatched, toggle, clearAll, reload,
  }), [watchedList, isLoading, add, remove, isWatched, toggle, clearAll, reload]);

  return <WatchedContext.Provider value={value}>{children}</WatchedContext.Provider>;
}

export function useWatchedContext(): WatchedContextType {
  const ctx = useContext(WatchedContext);
  if (ctx === null)
    throw new Error("useWatchedContext must be used within WatchedProvider");
  return ctx;
}
