import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useWatchlist } from "../hooks/useWatchlist";
import { useRatings } from "../hooks/useRatings";
import { useWatched } from "../hooks/useWatched";
import type { AppContextType } from "../types";
import type { Theme } from "../types";

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
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

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    );
  };

  const clearGenres = () => setSelectedGenres([]);
  const clearSearch = () => setSearchTerm("");

  const value: AppContextType = {
    searchTerm,
    setSearchTerm,
    clearSearch,
    selectedGenres,
    toggleGenre,
    clearGenres,
    theme,
    toggleTheme,
    watchlist: watchlist.watchlist,
    addToWatchlist: watchlist.add,
    removeFromWatchlist: watchlist.remove,
    isInWatchlist: watchlist.isIn,
    toggleWatchlist: watchlist.toggle,
    markWatched: watchlist.markWatched,
    watchedList: watched.watchedList,
    addToWatched: watched.add,
    removeFromWatched: watched.remove,
    isWatched: watched.isWatched,
    toggleWatched: watched.toggle,
    allRatings: ratings.ratings,
    setRating: ratings.set,
    getRating: ratings.get,
    removeRating: ratings.remove,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
