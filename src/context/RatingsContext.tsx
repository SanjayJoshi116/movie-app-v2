import { createContext, useContext, useMemo, ReactNode } from "react";
import { useRatings } from "../hooks/useRatings";

type RatingsContextType = ReturnType<typeof useRatings>;

export const RatingsContext = createContext<RatingsContextType | null>(null);

export function RatingsProvider({ children }: { children: ReactNode }) {
  const { ratings, isLoading, hasLoaded, error, set, get, remove, reload } = useRatings();

  const value = useMemo<RatingsContextType>(() => ({
    ratings, isLoading, hasLoaded, error, set, get, remove, reload,
  }), [ratings, isLoading, hasLoaded, error, set, get, remove, reload]);

  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>;
}

export function useRatingsContext(): RatingsContextType {
  const ctx = useContext(RatingsContext);
  if (ctx === null)
    throw new Error("useRatingsContext must be used within RatingsProvider");
  return ctx;
}
