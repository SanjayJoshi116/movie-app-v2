import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { useWatchlist } from "../useWatchlist";
import { AuthContext } from "../../context/AuthContext";
import type { WatchlistInput } from "../../types";

jest.mock("../../api/userApi", () => ({
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
const mockPatch = userApi.patch as jest.Mock;

const mockAuthValue = {
  user: { id: 1, username: "testuser", email: "t@t.com", first_name: "", last_name: "", is_staff: false, avatar_url: null },
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  setUserData: jest.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthContext.Provider, { value: mockAuthValue }, children);

const makeEntry = (overrides: Partial<WatchlistInput> = {}): WatchlistInput => ({
  id: 1,
  type: "movie",
  title: "Test Movie",
  posterPath: "/poster.jpg",
  voteAverage: 7.5,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ data: [] });
  mockPost.mockResolvedValue({ data: { id: 99, addedAt: "2024-01-01T00:00:00Z" } });
  mockDelete.mockResolvedValue({});
  mockPatch.mockResolvedValue({});
});

describe("useWatchlist", () => {
  it("add() creates entry with addedAt timestamp", async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.add(makeEntry()); });

    const entry = result.current.watchlist[0];
    expect(entry).toBeDefined();
    expect(Number.isFinite(Date.parse(entry!.addedAt))).toBe(true);
  });

  it("add() is no-op if id+type already exists", async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.add(makeEntry()); });
    await act(async () => { await result.current.add(makeEntry({ title: "Duplicate" })); });

    expect(result.current.watchlist).toHaveLength(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("remove() removes matching entry, leaves others", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: 10, addedAt: "2024-01-01T00:00:00Z" } })
      .mockResolvedValueOnce({ data: { id: 11, addedAt: "2024-01-01T00:00:00Z" } });

    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.add(makeEntry({ id: 1 })); });
    await act(async () => { await result.current.add(makeEntry({ id: 2, title: "Other" })); });
    await act(async () => { await result.current.remove(1, "movie"); });

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0]!.id).toBe(2);
  });

  it("isIn() returns true only for exact id+type match", async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.add(makeEntry({ id: 10, type: "movie" })); });

    expect(result.current.isIn(10, "movie")).toBe(true);
    expect(result.current.isIn(10, "tv")).toBe(false);
    expect(result.current.isIn(99, "movie")).toBe(false);
  });

  it("toggle() adds when not present, removes when already in", async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entry = makeEntry({ id: 5 });
    await act(async () => { await result.current.toggle(entry); });
    expect(result.current.isIn(5, "movie")).toBe(true);

    await act(async () => { await result.current.toggle(entry); });
    expect(result.current.isIn(5, "movie")).toBe(false);
  });

  it("loads watchlist from API on mount when authenticated", async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 42, mediaId: 7, mediaType: "movie", title: "Fetched", posterPath: null, voteAverage: 8, addedAt: "2024-06-01T00:00:00Z" },
      ],
    });

    const { result } = renderHook(() => useWatchlist(), { wrapper });

    await waitFor(() => expect(result.current.watchlist).toHaveLength(1));
    expect(result.current.watchlist[0]!.title).toBe("Fetched");
  });

  it("reports loading on the first render instead of an empty, loaded list", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("records an error when the initial load fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.watchlist).toHaveLength(0);
  });

  it("keeps loaded items and records the error when a reload fails", async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ id: 42, mediaId: 7, mediaType: "movie", title: "Kept", posterPath: null, voteAverage: 8, addedAt: "2024-06-01T00:00:00Z" }],
    });
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.watchlist).toHaveLength(1));

    mockGet.mockRejectedValueOnce(new Error("network"));
    await act(async () => { await expect(result.current.reload()).rejects.toThrow("network"); });

    expect(result.current.watchlist[0]!.title).toBe("Kept");
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("clears the error after a successful retry", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBeNull();
  });

  it("double toggle on the same item sends one request", async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entry = makeEntry({ id: 5 });
    await act(async () => {
      await Promise.all([result.current.toggle(entry), result.current.toggle(entry)]);
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.current.isIn(5, "movie")).toBe(true);
  });

  it("toggles on different items are independent", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: 10, addedAt: "2024-01-01T00:00:00Z" } })
      .mockResolvedValueOnce({ data: { id: 11, addedAt: "2024-01-01T00:00:00Z" } });
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await Promise.all([
        result.current.toggle(makeEntry({ id: 1 })),
        result.current.toggle(makeEntry({ id: 2 })),
      ]);
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("a failed add shares its rejection with the repeated click", async () => {
    mockPost.mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let outcomes: PromiseSettledResult<void>[] = [];
    await act(async () => {
      outcomes = await Promise.allSettled([result.current.add(makeEntry()), result.current.add(makeEntry())]);
    });

    expect(outcomes.map((o) => o.status)).toEqual(["rejected", "rejected"]);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.watchlist).toHaveLength(0);
  });
});
