import React, { createContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useWatchlist } from "../hooks/useWatchlist";
import { useRatings } from "../hooks/useRatings";
import { useWatched } from "../hooks/useWatched";
import type { AppContextType } from "../types";
import type { Theme } from "../types";

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [includeAdult, setIncludeAdult] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [theme, setTheme] = useLocalStorage<Theme>("cinedb_theme", "dark");

  const watchlist = useWatchlist();
  const ratings = useRatings();
  const watched = useWatched();

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [setTheme]
  );

  const toggleGenre = useCallback((genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    );
  }, []);

  const clearGenres = useCallback(() => setSelectedGenres([]), []);
  const clearSearch = useCallback(() => setSearchTerm(""), []);

  const isDataLoading = watchlist.isLoading || ratings.isLoading || watched.isLoading;

  const value = useMemo<AppContextType>(() => ({
    searchTerm,
    setSearchTerm,
    clearSearch,
    includeAdult,
    setIncludeAdult,
    selectedGenres,
    toggleGenre,
    clearGenres,
    theme,
    toggleTheme,
    watchlist: watchlist.watchlist,
    addToWatchlist: watchlist.add,
    removeFromWatchlist: watchlist.remove,
    clearAllWatchlist: watchlist.clearAll,
    isInWatchlist: watchlist.isIn,
    toggleWatchlist: watchlist.toggle,
    markWatched: watchlist.markWatched,
    watchedList: watched.watchedList,
    addToWatched: watched.add,
    removeFromWatched: watched.remove,
    clearAllWatched: watched.clearAll,
    reloadWatched: watched.reload,
    isWatched: watched.isWatched,
    toggleWatched: watched.toggle,
    allRatings: ratings.ratings,
    setRating: ratings.set,
    getRating: ratings.get,
    removeRating: ratings.remove,
    isDataLoading,
  }), [
    searchTerm, setSearchTerm, clearSearch,
    includeAdult, setIncludeAdult,
    selectedGenres, toggleGenre, clearGenres,
    theme, toggleTheme,
    watchlist.watchlist, watchlist.add, watchlist.remove, watchlist.clearAll, watchlist.isIn, watchlist.toggle, watchlist.markWatched,
    watched.watchedList, watched.add, watched.remove, watched.clearAll, watched.reload, watched.isWatched, watched.toggle,
    ratings.ratings, ratings.set, ratings.get, ratings.remove,
    isDataLoading,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
