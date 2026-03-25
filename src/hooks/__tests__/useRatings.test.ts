import { renderHook, act } from "@testing-library/react";
import { useRatings } from "../useRatings";

beforeEach(() => {
  localStorage.clear();
});

describe("useRatings", () => {
  it("set() stores at composite key 'type-id'", () => {
    const { result } = renderHook(() => useRatings());
    act(() => {
      result.current.set(1, "movie", "Test Movie", 8);
    });
    const key = "movie-1";
    const stored = JSON.parse(localStorage.getItem("cinedb_ratings")!);
    expect(stored[key]).toBeDefined();
    expect(stored[key].userRating).toBe(8);
  });

  it("set() defaults review to empty string", () => {
    const { result } = renderHook(() => useRatings());
    act(() => {
      result.current.set(1, "movie", "Test Movie", 7);
    });
    expect(result.current.get(1, "movie")!.review).toBe("");
  });

  it("get() returns matching entry", () => {
    const { result } = renderHook(() => useRatings());
    act(() => {
      result.current.set(2, "tv", "Test Show", 9, "Great!");
    });
    const entry = result.current.get(2, "tv");
    expect(entry).not.toBeNull();
    expect(entry!.userRating).toBe(9);
    expect(entry!.review).toBe("Great!");
    expect(entry!.title).toBe("Test Show");
  });

  it("get() returns null for missing key", () => {
    const { result } = renderHook(() => useRatings());
    expect(result.current.get(999, "movie")).toBeNull();
  });

  it("remove() deletes matching entry, leaves others", () => {
    const { result } = renderHook(() => useRatings());
    act(() => {
      result.current.set(1, "movie", "Movie A", 7);
      result.current.set(2, "movie", "Movie B", 8);
    });
    act(() => {
      result.current.remove(1, "movie");
    });
    expect(result.current.get(1, "movie")).toBeNull();
    expect(result.current.get(2, "movie")).not.toBeNull();
  });

  it("set() overwrites existing rating", () => {
    const { result } = renderHook(() => useRatings());
    act(() => {
      result.current.set(1, "movie", "Test", 5);
    });
    act(() => {
      result.current.set(1, "movie", "Test", 10, "Changed my mind!");
    });
    const entry = result.current.get(1, "movie");
    expect(entry!.userRating).toBe(10);
    expect(entry!.review).toBe("Changed my mind!");
  });

  it("ratedAt is valid ISO 8601", () => {
    const { result } = renderHook(() => useRatings());
    act(() => {
      result.current.set(1, "movie", "Test", 8);
    });
    const entry = result.current.get(1, "movie");
    expect(Number.isFinite(Date.parse(entry!.ratedAt))).toBe(true);
  });
});
