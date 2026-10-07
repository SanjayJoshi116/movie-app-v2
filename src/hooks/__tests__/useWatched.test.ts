import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { useWatched } from "../useWatched";
import { AuthContext } from "../../context/AuthContext";
import type { WatchedInput } from "../../types";

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

  it("remove while the add is in flight does not send a DELETE", async () => {
    const { result } = renderHook(() => useWatched(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await Promise.all([result.current.add(makeEntry({ id: 4 })), result.current.remove(4, "movie")]);
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
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
