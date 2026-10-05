import { renderHook, act } from "@testing-library/react";
import { useLibraryFilters } from "../useLibraryFilters";
import type { WatchlistEntry } from "../../types";

const makeItem = (overrides: Partial<WatchlistEntry> = {}): WatchlistEntry => ({
  id: 1,
  type: "movie",
  title: "Movie",
  posterPath: null,
  voteAverage: 5,
  addedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const ITEMS: WatchlistEntry[] = [
  makeItem({ id: 1, title: "Batman Begins", type: "movie", voteAverage: 8, addedAt: "2024-01-01T00:00:00Z" }),
  makeItem({ id: 2, title: "The Wire", type: "tv", voteAverage: 9, addedAt: "2024-03-01T00:00:00Z" }),
  makeItem({ id: 3, title: "Batman Returns", type: "movie", voteAverage: 6, addedAt: "2024-02-01T00:00:00Z" }),
];

const SORT_FNS = {
  "added-desc": (a: WatchlistEntry, b: WatchlistEntry) => b.addedAt.localeCompare(a.addedAt),
  "title-asc": (a: WatchlistEntry, b: WatchlistEntry) => a.title.localeCompare(b.title),
  "rating-desc": (a: WatchlistEntry, b: WatchlistEntry) => b.voteAverage - a.voteAverage,
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("useLibraryFilters", () => {
  it("returns all items sorted by default when untouched", () => {
    const { result } = renderHook(() =>
      useLibraryFilters({ keyPrefix: "test", items: ITEMS, sortFns: SORT_FNS, defaultSort: "added-desc" })
    );

    expect(result.current.isDefault).toBe(true);
    expect(result.current.filtered.map((i) => i.id)).toEqual([2, 3, 1]); // added-desc
  });

  it("filters by search substring, case-insensitive", () => {
    const { result } = renderHook(() =>
      useLibraryFilters({ keyPrefix: "test", items: ITEMS, sortFns: SORT_FNS, defaultSort: "added-desc" })
    );

    act(() => result.current.setSearch("batman"));

    expect(result.current.filtered.map((i) => i.id).sort()).toEqual([1, 3]);
    expect(result.current.isDefault).toBe(false);
  });

  it("filters by type", () => {
    // Type filtering needs a getType accessor; without one it's a deliberate no-op.
    const { result } = renderHook(() =>
      useLibraryFilters({
        keyPrefix: "test",
        items: ITEMS,
        sortFns: SORT_FNS,
        defaultSort: "added-desc",
        getType: (i) => i.type,
      })
    );

    act(() => result.current.setTypeFilter("tv"));

    expect(result.current.filtered.map((i) => i.id)).toEqual([2]);
  });

  it("applies the selected sort", () => {
    const { result } = renderHook(() =>
      useLibraryFilters({ keyPrefix: "test", items: ITEMS, sortFns: SORT_FNS, defaultSort: "added-desc" })
    );

    act(() => result.current.setSortKey("title-asc"));
    expect(result.current.filtered.map((i) => i.title)).toEqual(["Batman Begins", "Batman Returns", "The Wire"]);

    act(() => result.current.setSortKey("rating-desc"));
    expect(result.current.filtered.map((i) => i.id)).toEqual([2, 1, 3]);
  });

  it("applies an extraFilter predicate on top of type/search", () => {
    const { result } = renderHook(() =>
      useLibraryFilters({
        keyPrefix: "test",
        items: ITEMS,
        sortFns: SORT_FNS,
        defaultSort: "added-desc",
        extraFilter: (i) => i.voteAverage >= 8,
      })
    );

    expect(result.current.filtered.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it("resetFilters clears search/sort/type back to defaults", () => {
    const { result } = renderHook(() =>
      useLibraryFilters({ keyPrefix: "test", items: ITEMS, sortFns: SORT_FNS, defaultSort: "added-desc" })
    );

    act(() => {
      result.current.setSearch("batman");
      result.current.setSortKey("title-asc");
      result.current.setTypeFilter("movie");
    });
    expect(result.current.isDefault).toBe(false);

    act(() => result.current.resetFilters());

    expect(result.current.isDefault).toBe(true);
    expect(result.current.search).toBe("");
    expect(result.current.sortKey).toBe("added-desc");
    expect(result.current.typeFilter).toBe("all");
  });

  it("persists search/sort/type to sessionStorage under keyPrefix, restored on remount", () => {
    const { result, unmount } = renderHook(() =>
      useLibraryFilters({ keyPrefix: "mykey", items: ITEMS, sortFns: SORT_FNS, defaultSort: "added-desc" })
    );

    act(() => result.current.setSearch("wire"));
    unmount();

    expect(sessionStorage.getItem("mykey_search")).toBe("wire");

    const { result: result2 } = renderHook(() =>
      useLibraryFilters({ keyPrefix: "mykey", items: ITEMS, sortFns: SORT_FNS, defaultSort: "added-desc" })
    );
    expect(result2.current.search).toBe("wire");
  });
});
