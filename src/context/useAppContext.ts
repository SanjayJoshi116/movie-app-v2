import { useContext } from "react";
import { UIContext } from "./UIContext";
import { WatchlistContext } from "./WatchlistContext";
import { WatchedContext } from "./WatchedContext";
import { RatingsContext } from "./RatingsContext";
import type { AppContextType } from "../types";

/**
 * Back-compat shim: merges the split UI/Watchlist/Watched/Ratings contexts
 * into the original combined shape. Prefer the specific `use*Context` hooks
 * in new code so unrelated state changes don't force a re-render.
 */
export function useAppContext(): AppContextType {
  const ui = useContext(UIContext);
  const watchlist = useContext(WatchlistContext);
  const watched = useContext(WatchedContext);
  const ratings = useContext(RatingsContext);

  if (ui === null || watchlist === null || watched === null || ratings === null) {
    throw new Error("useAppContext must be used within AppProvider");
  }

  return {
    searchTerm: ui.searchTerm,
    setSearchTerm: ui.setSearchTerm,
    clearSearch: ui.clearSearch,
    includeAdult: ui.includeAdult,
    setIncludeAdult: ui.setIncludeAdult,
    selectedGenres: ui.selectedGenres,
    toggleGenre: ui.toggleGenre,
    clearGenres: ui.clearGenres,
    theme: ui.theme,
    toggleTheme: ui.toggleTheme,
    watchlist: watchlist.watchlist,
    addToWatchlist: watchlist.add,
    removeFromWatchlist: watchlist.remove,
    clearAllWatchlist: watchlist.clearAll,
    isInWatchlist: watchlist.isIn,
    toggleWatchlist: watchlist.toggle,
    reloadWatchlist: watchlist.reload,
    watchlistError: watchlist.error,
    watchedList: watched.watchedList,
    addToWatched: watched.add,
    removeFromWatched: watched.remove,
    clearAllWatched: watched.clearAll,
    reloadWatched: watched.reload,
    watchedError: watched.error,
    isWatched: watched.isWatched,
    toggleWatched: watched.toggle,
    allRatings: ratings.ratings,
    setRating: ratings.set,
    getRating: ratings.get,
    removeRating: ratings.remove,
    reloadRatings: ratings.reload,
    ratingsError: ratings.error,
    isDataLoading: watchlist.isLoading || watched.isLoading || ratings.isLoading,
  };
}
