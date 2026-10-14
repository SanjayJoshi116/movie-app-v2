import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AuthContext } from "./AuthContext";
import type { Theme } from "../types";

interface UIContextType {
  searchTerm: string;
  setSearchTerm(t: string): void;
  clearSearch(): void;
  includeAdult: boolean;
  setIncludeAdult(v: boolean): void;
  selectedGenres: number[];
  toggleGenre(id: number): void;
  /** Replace the picks at once (the filter drawer's Apply). */
  setGenres(ids: number[]): void;
  clearGenres(): void;
  theme: Theme;
  toggleTheme(): void;
}

export const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [includeAdult, setIncludeAdult] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [theme, setTheme] = useLocalStorage<Theme>("cinedb_theme", "dark");

  // Browse settings belong to the session: on sign-out they go back to the
  // defaults, so the next account in this tab doesn't inherit "include adult"
  // or genre picks. During render, like App's scope reset, so no page fetches
  // with the old values first. Theme is a device preference and stays. Read
  // from the context, not useAuth(), so UIProvider also renders without auth.
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;
  const [wasAuthenticated, setWasAuthenticated] = useState(isAuthenticated);
  if (wasAuthenticated !== isAuthenticated) {
    setWasAuthenticated(isAuthenticated);
    if (!isAuthenticated) {
      setSearchTerm("");
      setIncludeAdult(false);
      setSelectedGenres([]);
    }
  }

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

  const setGenres = useCallback((ids: number[]) => setSelectedGenres(ids), []);
  const clearGenres = useCallback(() => setSelectedGenres([]), []);
  const clearSearch = useCallback(() => setSearchTerm(""), []);

  const value = useMemo<UIContextType>(() => ({
    searchTerm,
    setSearchTerm,
    clearSearch,
    includeAdult,
    setIncludeAdult,
    selectedGenres,
    toggleGenre,
    setGenres,
    clearGenres,
    theme,
    toggleTheme,
  }), [
    searchTerm, clearSearch,
    includeAdult,
    selectedGenres, toggleGenre, setGenres, clearGenres,
    theme, toggleTheme,
  ]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext(): UIContextType {
  const ctx = useContext(UIContext);
  if (ctx === null)
    throw new Error("useUIContext must be used within UIProvider");
  return ctx;
}
