import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useEpisodeProgress } from "../useEpisodeProgress";
import { AuthContext } from "../../context/AuthContext";
import { getEpisodeProgress, setEpisodeProgress, deleteEpisodeProgress } from "../../api/userApi";

let mockGeneration = 0;
jest.mock("../../api/userApi", () => ({
  __esModule: true,
  getEpisodeProgress: jest.fn(),
  setEpisodeProgress: jest.fn(),
  deleteEpisodeProgress: jest.fn(),
  currentSessionGeneration: () => mockGeneration,
  isCurrentSession: (gen: number) => gen === mockGeneration,
}));

const mockGet = getEpisodeProgress as jest.Mock;
const mockSet = setEpisodeProgress as jest.Mock;
const mockDelete = deleteEpisodeProgress as jest.Mock;

const auth = {
  user: { id: 1, username: "u", email: "", first_name: "", last_name: "", is_staff: false, avatar_url: null },
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  setUserData: jest.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthContext.Provider, { value: auth }, children);

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const progress = (showId: number, season: number, episode: number) => ({ data: { showId, season, episode } });

beforeEach(() => {
  jest.clearAllMocks();
  mockGeneration = 0;
});

describe("useEpisodeProgress", () => {
  it("loads the show's progress", async () => {
    mockGet.mockResolvedValue(progress(1396, 2, 5));
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.progress).toEqual({ showId: 1396, season: 2, episode: 5 }));
    expect(result.current.loading).toBe(false);
  });

  it("resets when the show changes and ignores the previous show's late response", async () => {
    const slow = deferred<ReturnType<typeof progress>>();
    mockGet.mockImplementation((id: number) => (id === 1 ? slow.promise : Promise.resolve(progress(2, 1, 1))));
    const { result, rerender } = renderHook(({ id }) => useEpisodeProgress(id), { wrapper, initialProps: { id: 1 } });

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.progress).toEqual({ showId: 2, season: 1, episode: 1 }));

    await act(async () => { slow.resolve(progress(1, 9, 9)); });
    expect(result.current.progress).toEqual({ showId: 2, season: 1, episode: 1 });
  });

  it("update and clear write through", async () => {
    mockGet.mockResolvedValue({ data: null });
    mockSet.mockResolvedValue(progress(1396, 1, 2));
    mockDelete.mockResolvedValue({});
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.update(1, 2); });
    expect(mockSet).toHaveBeenCalledWith(1396, 1, 2);
    expect(result.current.progress).toEqual({ showId: 1396, season: 1, episode: 2 });

    await act(async () => { await result.current.clear(); });
    expect(result.current.progress).toBeNull();
  });

  it("a failed load is an error, not 'no progress', and retry loads it", async () => {
    mockGet.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(progress(1396, 3, 4));
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.progress).toBeNull();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.progress).toEqual({ showId: 1396, season: 3, episode: 4 }));
    expect(result.current.error).toBe(false);
  });

  it("a failed update clears busy and rejects", async () => {
    mockGet.mockResolvedValue({ data: null });
    mockSet.mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.update(2, 4)).rejects.toThrow("500");
    });
    expect(result.current.busy).toBe(false);
  });

  it("a double update sends one request and both settle with it", async () => {
    mockGet.mockResolvedValue({ data: null });
    const write = deferred<ReturnType<typeof progress>>();
    mockSet.mockReturnValue(write.promise);
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.update(1, 2);
      second = result.current.update(1, 2);
    });
    expect(mockSet).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.busy).toBe(true));

    await act(async () => {
      write.resolve(progress(1396, 1, 2));
      await Promise.all([first, second]);
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.progress).toEqual({ showId: 1396, season: 1, episode: 2 });
  });

  it("Remove during Next waits for Next, then removes, and reports its own outcome", async () => {
    mockGet.mockResolvedValue(progress(1396, 1, 1));
    const advance = deferred<ReturnType<typeof progress>>();
    mockSet.mockReturnValue(advance.promise);
    const remove = deferred<object>();
    mockDelete.mockReturnValue(remove.promise);
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let next!: Promise<void>;
    let cleared = false;
    act(() => {
      next = result.current.update(1, 2);
      void result.current.clear().then(() => { cleared = true; });
    });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled(); // queued behind Next

    await act(async () => {
      advance.resolve(progress(1396, 1, 2));
      await next;
    });
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(cleared).toBe(false); // not settled with Next's result
    expect(result.current.busy).toBe(true);

    await act(async () => { remove.resolve({}); });
    await waitFor(() => expect(cleared).toBe(true));
    expect(result.current.progress).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("a queued write still runs after the first one fails", async () => {
    mockGet.mockResolvedValue(progress(1396, 1, 1));
    mockSet.mockRejectedValue(new Error("500"));
    mockDelete.mockResolvedValue({});
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const next = result.current.update(1, 2);
      const clear = result.current.clear();
      await expect(next).rejects.toThrow("500");
      await clear;
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toBeNull();
  });

  it("a write that answers after sign-out doesn't set progress", async () => {
    mockGet.mockResolvedValue({ data: null });
    const write = deferred<ReturnType<typeof progress>>();
    mockSet.mockReturnValue(write.promise);
    const { result } = renderHook(() => useEpisodeProgress(1396), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saving!: Promise<void>;
    act(() => { saving = result.current.update(4, 7); });
    mockGeneration += 1; // signed out (and maybe in as someone else)
    await act(async () => {
      write.resolve(progress(1396, 4, 7));
      await saving;
    });
    expect(result.current.progress).toBeNull();
  });
});
