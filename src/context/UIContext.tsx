import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AuthContext } from "./AuthContext";
import type { Theme } from "../types";
import { deviceRegion } from "../utils/region";

interface UIContextType {
  searchTerm: string;
  setSearchTerm(t: string): void;
  clearSearch(): void;
  includeAdult: boolean;
  setIncludeAdult(v: boolean): void;
  theme: Theme;
  toggleTheme(): void;
  /** Region for where-to-watch data (ISO 3166-1, e.g. "IN"); a device preference. */
  region: string;
  setRegion(code: string): void;
}

export const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [includeAdult, setIncludeAdult] = useState(false);
  const [theme, setTheme] = useLocalStorage<Theme>("cinedb_theme", "dark");
  // Like the theme, a device preference: kept across sign-out.
  const [region, setRegion] = useLocalStorage<string>("cinedb_region", deviceRegion());

  // Browse settings belong to the session: on sign-out they go back to the
  // defaults, so the next account in this tab doesn't inherit "include adult".
  // During render, like App's scope reset, so no page fetches
  // with the old values first. Theme is a device preference and stays. Read
  // from the context, not useAuth(), so UIProvider also renders without auth.
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;
  const [wasAuthenticated, setWasAuthenticated] = useState(isAuthenticated);
  if (wasAuthenticated !== isAuthenticated) {
    setWasAuthenticated(isAuthenticated);
    if (!isAuthenticated) {
      setSearchTerm("");
      setIncludeAdult(false);
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

  const clearSearch = useCallback(() => setSearchTerm(""), []);

  const value = useMemo<UIContextType>(() => ({
    searchTerm,
    setSearchTerm,
    clearSearch,
    includeAdult,
    setIncludeAdult,
    theme,
    toggleTheme,
    region,
    setRegion,
  }), [
    searchTerm, clearSearch,
    includeAdult,
    theme, toggleTheme,
    region, setRegion,
  ]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext(): UIContextType {
  const ctx = useContext(UIContext);
  if (ctx === null)
    throw new Error("useUIContext must be used within UIProvider");
  return ctx;
}
