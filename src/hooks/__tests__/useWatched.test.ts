import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { useWatched } from "../useWatched";
import { AuthContext } from "../../context/AuthContext";
import type { WatchedInput } from "../../types";

jest.mock("../../api/userApi", () => ({
  // One session throughout: the stale-session guard is covered in sessionGeneration.test.tsx.
  currentSessionGeneration: () => 0,
  isCurrentSession: () => true,
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


const makeEntry = (overrides: Partial<WatchedInput> = {}): WatchedInput => ({
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
  mockPost.mockResolvedValue({ data: { id: 99, watchedAt: "2024-01-01T00:00:00Z" } });
  mockDelete.mockResolvedValue({});
  mockPatch.mockResolvedValue({});
});

describe("useWatched", () => {
  it("reports loading on the first render", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWatched(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("records an error when the initial load fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.watchedList).toHaveLength(0);
  });

  it("double toggle on the same item sends one POST", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entry = makeEntry({ id: 3 });
    await act(async () => {
      await Promise.all([result.current.toggle(entry), result.current.toggle(entry)]);
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.current.isWatched(3, "movie")).toBe(true);
  });

  it("remove while the add is in flight runs after it and ends unwatched", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await Promise.all([result.current.add(makeEntry({ id: 4 })), result.current.remove(4, "movie")]);
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith("/watched/99/");
    expect(mockPost.mock.invocationCallOrder[0]).toBeLessThan(mockDelete.mock.invocationCallOrder[0]!);
    expect(result.current.isWatched(4, "movie")).toBe(false);
  });

  it("a reload that started before an add and lands after it keeps the item", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let answerStale!: (v: unknown) => void;
    mockGet
      .mockReturnValueOnce(new Promise((res) => { answerStale = res; })) // the stale reload
      .mockResolvedValueOnce({ data: [{ id: 99, mediaId: 5, mediaType: "movie", title: "T", posterPath: null,
        voteAverage: 7, watchedAt: "2024-01-01T00:00:00Z", watchedTz: "" }] }); // its rerun
    let reloading!: Promise<void>;
    act(() => { reloading = result.current.reload(); });
    await act(async () => { await result.current.add(makeEntry({ id: 5 })); });
    await act(async () => { answerStale({ data: [] }); await reloading; });

    expect(mockGet).toHaveBeenCalledTimes(3); // mount, stale (dropped), rerun
    expect(result.current.isWatched(5, "movie")).toBe(true);
    await act(async () => { await result.current.remove(5, "movie"); });
    expect(mockDelete).toHaveBeenCalledWith("/watched/99/");
  });

  it("Clear All during a pending add is sent after it and ends empty", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let answerAdd!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((res) => { answerAdd = res; }));
    let adding!: Promise<void>;
    let clearing!: Promise<void>;
    act(() => {
      adding = result.current.add(makeEntry({ id: 6 }));
      clearing = result.current.clearAll();
    });
    expect(mockDelete).not.toHaveBeenCalled();
    await act(async () => {
      answerAdd({ data: { id: 100, watchedAt: "2024-01-01T00:00:00Z" } });
      await Promise.all([adding, clearing]);
    });
    expect(mockDelete).toHaveBeenCalledWith("/watched/clear/");
    expect(result.current.watchedList).toEqual([]);
  });

  it("an add during a clear is sent after the clear", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let answerClear!: (v: unknown) => void;
    mockDelete.mockReturnValueOnce(new Promise((res) => { answerClear = res; }));
    let clearing!: Promise<void>;
    let adding!: Promise<void>;
    act(() => {
      clearing = result.current.clearAll();
      adding = result.current.add(makeEntry({ id: 7 }));
    });
    expect(mockPost).not.toHaveBeenCalled();
    await act(async () => { answerClear({}); await Promise.all([clearing, adding]); });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.isWatched(7, "movie")).toBe(true);
  });

  it("toggle after the first write settles runs normally", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entry = makeEntry({ id: 6 });
    await act(async () => { await result.current.toggle(entry); });
    await act(async () => { await result.current.toggle(entry); });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result.current.isWatched(6, "movie")).toBe(false);
  });

  it("puts a newly watched title first (newest-first, like the API)", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.add(makeEntry({ id: 7, title: "Older" })); });
    await act(async () => { await result.current.add(makeEntry({ id: 8, title: "Newer" })); });

    expect(result.current.watchedList.map((i) => i.id)).toEqual([8, 7]);
  });
});
