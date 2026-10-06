import { createContext, useContext, useMemo, ReactNode } from "react";
import { useWatchlist } from "../hooks/useWatchlist";

type WatchlistContextType = ReturnType<typeof useWatchlist>;

export const WatchlistContext = createContext<WatchlistContextType | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { watchlist, isLoading, error, add, remove, clearAll, isIn, toggle, reload } = useWatchlist();

  const value = useMemo<WatchlistContextType>(() => ({
    watchlist, isLoading, error, add, remove, clearAll, isIn, toggle, reload,
  }), [watchlist, isLoading, error, add, remove, clearAll, isIn, toggle, reload]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlistContext(): WatchlistContextType {
  const ctx = useContext(WatchlistContext);
  if (ctx === null)
    throw new Error("useWatchlistContext must be used within WatchlistProvider");
  return ctx;
}
