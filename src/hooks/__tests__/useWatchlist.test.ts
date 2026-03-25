import { renderHook, act } from "@testing-library/react";
import { useWatchlist } from "../useWatchlist";
import type { WatchlistInput } from "../../types";

beforeEach(() => {
  localStorage.clear();
});

const makeEntry = (overrides: Partial<WatchlistInput> = {}): WatchlistInput => ({
  id: 1,
  type: "movie",
  title: "Test Movie",
  posterPath: "/poster.jpg",
  voteAverage: 7.5,
  ...overrides,
});

describe("useWatchlist", () => {
  it("add() creates entry with addedAt timestamp and watched=false", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry());
    });
    const entry = result.current.watchlist[0];
    expect(entry).toBeDefined();
    expect(entry!.watched).toBe(false);
    expect(Number.isFinite(Date.parse(entry!.addedAt))).toBe(true);
  });

  it("add() is no-op if id+type already exists", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry());
      result.current.add(makeEntry({ title: "Duplicate" }));
    });
    expect(result.current.watchlist).toHaveLength(1);
  });

  it("remove() removes matching entry, leaves others", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry({ id: 1 }));
      result.current.add(makeEntry({ id: 2, title: "Other" }));
    });
    act(() => {
      result.current.remove(1, "movie");
    });
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0]!.id).toBe(2);
  });

  it("isIn() returns true only for exact id+type match", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry({ id: 10, type: "movie" }));
    });
    expect(result.current.isIn(10, "movie")).toBe(true);
    expect(result.current.isIn(10, "tv")).toBe(false);
    expect(result.current.isIn(99, "movie")).toBe(false);
  });

  it("toggle() adds when not present, removes when already in", () => {
    const { result } = renderHook(() => useWatchlist());
    const entry = makeEntry({ id: 5 });
    act(() => {
      result.current.toggle(entry);
    });
    expect(result.current.isIn(5, "movie")).toBe(true);
    act(() => {
      result.current.toggle(entry);
    });
    expect(result.current.isIn(5, "movie")).toBe(false);
  });

  it("markWatched() flips watched flag on matching item only", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry({ id: 1 }));
      result.current.add(makeEntry({ id: 2, title: "Other" }));
    });
    act(() => {
      result.current.markWatched(1, "movie", true);
    });
    expect(result.current.watchlist.find((i) => i.id === 1)!.watched).toBe(true);
    expect(result.current.watchlist.find((i) => i.id === 2)!.watched).toBe(false);
  });

  it("persists across hook remounts (round-trips through localStorage)", () => {
    const { result, unmount } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry({ id: 7, title: "Persisted" }));
    });
    unmount();
    const { result: result2 } = renderHook(() => useWatchlist());
    expect(result2.current.watchlist).toHaveLength(1);
    expect(result2.current.watchlist[0]!.title).toBe("Persisted");
  });
});
