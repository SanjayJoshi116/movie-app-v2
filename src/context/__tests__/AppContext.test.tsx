import React from "react";
import { renderHook, act } from "@testing-library/react";
import { AppProvider } from "../AppContext";
import { useAppContext } from "../useAppContext";
import type { WatchlistInput } from "../../types";

beforeEach(() => {
  localStorage.clear();
  document.body.className = "";
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe("AppContext", () => {
  it("useAppContext() throws when used outside AppProvider", () => {
    expect(() => renderHook(() => useAppContext())).toThrow(
      "useAppContext must be used within AppProvider"
    );
  });

  it("AppProvider renders children", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    expect(result.current).toBeDefined();
  });

  it("theme defaults to 'dark' and body has dark-theme class", () => {
    renderHook(() => useAppContext(), { wrapper });
    expect(document.body.classList.contains("dark-theme")).toBe(true);
  });

  it("toggleTheme() switches theme and updates body class", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    expect(result.current.theme).toBe("dark");
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
    expect(document.body.classList.contains("dark-theme")).toBe(false);
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");
    expect(document.body.classList.contains("dark-theme")).toBe(true);
  });

  it("setSearchTerm and clearSearch work correctly", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    act(() => {
      result.current.setSearchTerm("inception");
    });
    expect(result.current.searchTerm).toBe("inception");
    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.searchTerm).toBe("");
  });

  it("toggleGenre adds then removes same id", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    act(() => {
      result.current.toggleGenre(28);
    });
    expect(result.current.selectedGenres).toContain(28);
    act(() => {
      result.current.toggleGenre(28);
    });
    expect(result.current.selectedGenres).not.toContain(28);
  });

  it("clearGenres empties the array", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    act(() => {
      result.current.toggleGenre(28);
      result.current.toggleGenre(12);
    });
    expect(result.current.selectedGenres).toHaveLength(2);
    act(() => {
      result.current.clearGenres();
    });
    expect(result.current.selectedGenres).toHaveLength(0);
  });

  it("watchlist round-trip: add, isIn, remove", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    const entry: WatchlistInput = {
      id: 550,
      type: "movie",
      title: "Fight Club",
      posterPath: "/poster.jpg",
      voteAverage: 8.4,
    };
    act(() => {
      result.current.addToWatchlist(entry);
    });
    expect(result.current.isInWatchlist(550, "movie")).toBe(true);
    expect(result.current.watchlist).toHaveLength(1);
    act(() => {
      result.current.removeFromWatchlist(550, "movie");
    });
    expect(result.current.isInWatchlist(550, "movie")).toBe(false);
    expect(result.current.watchlist).toHaveLength(0);
  });

  it("ratings round-trip: set, get, remove", () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    act(() => {
      result.current.setRating(550, "movie", "Fight Club", 10, "Masterpiece");
    });
    const rating = result.current.getRating(550, "movie");
    expect(rating).not.toBeNull();
    expect(rating!.userRating).toBe(10);
    expect(rating!.review).toBe("Masterpiece");
    act(() => {
      result.current.removeRating(550, "movie");
    });
    expect(result.current.getRating(550, "movie")).toBeNull();
  });
});
