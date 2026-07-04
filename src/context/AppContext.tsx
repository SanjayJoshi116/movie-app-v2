import { ReactNode } from "react";
import { UIProvider } from "./UIContext";
import { WatchlistProvider } from "./WatchlistContext";
import { WatchedProvider } from "./WatchedContext";
import { RatingsProvider } from "./RatingsContext";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <UIProvider>
      <WatchlistProvider>
        <WatchedProvider>
          <RatingsProvider>{children}</RatingsProvider>
        </WatchedProvider>
      </WatchlistProvider>
    </UIProvider>
  );
}
