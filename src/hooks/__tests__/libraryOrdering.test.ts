import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { useWatchlist } from "../useWatchlist";
import { useRatings } from "../useRatings";
import { useLists } from "../useLists";
import { AuthContext } from "../../context/AuthContext";

// write-feedback / load-states: library writes are ordered with reloads and
// clears, ratings have a per-title slot, and a collection is loading (not
// empty) from the first render after a sign-in.

let mockGeneration = 1;
jest.mock("../../api/userApi", () => ({
  currentSessionGeneration: () => mockGeneration,
  isCurrentSession: (gen: number) => gen === mockGeneration,
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

const mockGet = userApi.get as jest.Mock;
const mockPost = userApi.post as jest.Mock;
const mockDelete = userApi.delete as jest.Mock;

const authValue = (isAuthenticated: boolean) => ({
  user: isAuthenticated ? { id: 1, username: "u", email: "", first_name: "", last_name: "", is_staff: false, avatar_url: null } : null,
  isLoading: false,
  isAuthenticated,
  login: jest.fn(), register: jest.fn(), logout: jest.fn(), updateProfile: jest.fn(), setUserData: jest.fn(),
}) as unknown as React.ContextType<typeof AuthContext>;

function withAuth(state: { signedIn: boolean }) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthContext.Provider, { value: authValue(state.signedIn) }, children);
}

function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGeneration = 1;
  mockGet.mockResolvedValue({ data: [] });
  mockPost.mockResolvedValue({ data: { id: 50, addedAt: "2024-01-01T00:00:00Z", ratedAt: "2024-01-01T00:00:00Z" } });
  mockDelete.mockResolvedValue({});
});

describe("loading after sign-in", () => {
  const hooks: [string, () => { isLoading: boolean }][] = [
    ["watchlist", () => useWatchlist()],
    ["ratings", () => useRatings()],
    ["lists", () => useLists()],
  ];
  it.each(hooks)("%s reads as loading on every render after a sign-in until it loads", async (_name, hook) => {
    const state = { signedIn: true };
    const seen: boolean[] = [];
    const { result, rerender } = renderHook(() => {
      const r = hook();
      seen.push(r.isLoading);
      return r;
    }, { wrapper: withAuth(state) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    state.signedIn = false;
    mockGeneration += 1; // sign-out
    rerender();
    mockGet.mockReturnValue(new Promise(() => {}));
    const fromSignIn = seen.length;
    state.signedIn = true;
    mockGeneration += 1; // sign-in as someone
    rerender();
    // Including the render before any effect for this session ran: never
    // "loaded and empty" while nothing has loaded yet.
    expect(seen.slice(fromSignIn)).not.toContain(false);
    expect(seen.length).toBeGreaterThan(fromSignIn);
  });
});

describe("useWatchlist ordering", () => {
  it("unmark during a pending add runs after it and ends not in the watchlist", async () => {
    const state = { signedIn: true };
    const { result } = renderHook(() => useWatchlist(), { wrapper: withAuth(state) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const entry = { id: 3, type: "movie" as const, title: "T", posterPath: null, voteAverage: 7 };
    await act(async () => { await Promise.all([result.current.add(entry), result.current.remove(3, "movie")]); });
    expect(mockDelete).toHaveBeenCalledWith("/watchlist/50/");
    expect(result.current.isIn(3, "movie")).toBe(false);
  });
});

describe("useRatings in-flight slot", () => {
  it("saving the same rating twice sends one request", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper: withAuth({ signedIn: true }) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const save = deferred();
    mockPost.mockReturnValueOnce(save.promise);
    let a!: Promise<void>;
    let b!: Promise<void>;
    act(() => {
      a = result.current.set(1, "movie", "T", 8, "good");
      b = result.current.set(1, "movie", "T", 8, "good");
    });
    await act(async () => { save.resolve({ data: { id: 50, ratedAt: "2024-01-01T00:00:00Z" } }); await Promise.all([a, b]); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.get(1, "movie")?.userRating).toBe(8);
  });

  it("a remove during a pending save runs after it", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper: withAuth({ signedIn: true }) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await Promise.all([result.current.set(1, "movie", "T", 8), result.current.remove(1, "movie")]);
    });
    expect(mockDelete).toHaveBeenCalledWith("/ratings/50/");
    expect(result.current.get(1, "movie")).toBeNull();
  });
});

describe("useLists ordering", () => {
  const LIST = { id: 7, name: "Faves", description: "", createdAt: "2024-01-01T00:00:00Z", items: [
    { id: 11, mediaId: 1, mediaType: "movie", title: "Old", posterPath: null, voteAverage: 7, addedAt: "2024-01-01T00:00:00Z" },
  ] };

  it("an add during a clear is sent after it, and the list ends with only that title", async () => {
    mockGet.mockResolvedValue({ data: [LIST] });
    const { result } = renderHook(() => useLists(), { wrapper: withAuth({ signedIn: true }) });
    await waitFor(() => expect(result.current.lists).toHaveLength(1));

    const clear = deferred();
    mockDelete.mockReturnValueOnce(clear.promise);
    let clearing!: Promise<void>;
    let adding!: Promise<void>;
    act(() => {
      clearing = result.current.clearList(7);
      // Re-adding a title that was in the list before the clear.
      adding = result.current.addToList(7, { id: 1, type: "movie", title: "Old", posterPath: null, voteAverage: 7 });
    });
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => { clear.resolve({}); await Promise.all([clearing, adding]); });

    expect(mockPost).toHaveBeenCalledWith("/lists/7/items/", expect.objectContaining({ mediaId: 1 }));
    expect(result.current.lists[0]!.items.map((i) => i.id)).toEqual([1]);
  });

  it("other lists aren't held up by one list's clear", async () => {
    mockGet.mockResolvedValue({ data: [LIST, { ...LIST, id: 8, items: [] }] });
    const { result } = renderHook(() => useLists(), { wrapper: withAuth({ signedIn: true }) });
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockDelete.mockReturnValueOnce(new Promise(() => {}));
    act(() => { void result.current.clearList(7); });
    await act(async () => {
      await result.current.addToList(8, { id: 2, type: "movie", title: "New", posterPath: null, voteAverage: 7 });
    });
    expect(mockPost).toHaveBeenCalledWith("/lists/8/items/", expect.objectContaining({ mediaId: 2 }));
  });
});
