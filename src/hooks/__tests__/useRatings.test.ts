import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { useRatings } from "../useRatings";
import { AuthContext } from "../../context/AuthContext";

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

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ data: [] });
  mockPost.mockResolvedValue({ data: { id: 99, ratedAt: "2024-06-01T12:00:00Z" } });
  mockDelete.mockResolvedValue({});
});

describe("useRatings", () => {
  it("set() stores at composite key 'type-id' in memory", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.set(1, "movie", "Test Movie", 8); });

    const entry = result.current.get(1, "movie");
    expect(entry).not.toBeNull();
    expect(entry!.userRating).toBe(8);
  });

  it("set() defaults review to empty string", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.set(1, "movie", "Test Movie", 7); });

    expect(result.current.get(1, "movie")!.review).toBe("");
  });

  it("get() returns matching entry", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.set(2, "tv", "Test Show", 9, "Great!"); });

    const entry = result.current.get(2, "tv");
    expect(entry).not.toBeNull();
    expect(entry!.userRating).toBe(9);
    expect(entry!.review).toBe("Great!");
    expect(entry!.title).toBe("Test Show");
  });

  it("get() returns null for missing key", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.get(999, "movie")).toBeNull();
  });

  it("remove() deletes matching entry, leaves others", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: 10, ratedAt: "2024-06-01T00:00:00Z" } })
      .mockResolvedValueOnce({ data: { id: 11, ratedAt: "2024-06-01T00:00:00Z" } });

    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.set(1, "movie", "Movie A", 7); });
    await act(async () => { await result.current.set(2, "movie", "Movie B", 8); });
    await act(async () => { await result.current.remove(1, "movie"); });

    expect(result.current.get(1, "movie")).toBeNull();
    expect(result.current.get(2, "movie")).not.toBeNull();
  });

  it("set() overwrites existing rating", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { id: 10, ratedAt: "2024-06-01T00:00:00Z" } })
      .mockResolvedValueOnce({ data: { id: 10, ratedAt: "2024-06-02T00:00:00Z" } });

    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.set(1, "movie", "Test", 5); });
    await act(async () => { await result.current.set(1, "movie", "Test", 10, "Changed my mind!"); });

    const entry = result.current.get(1, "movie");
    expect(entry!.userRating).toBe(10);
    expect(entry!.review).toBe("Changed my mind!");
  });

  it("ratedAt is valid ISO 8601", async () => {
    const { result } = renderHook(() => useRatings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.set(1, "movie", "Test", 8); });

    const entry = result.current.get(1, "movie");
    expect(Number.isFinite(Date.parse(entry!.ratedAt))).toBe(true);
  });

  it("reports loading on the first render, then an error when the load fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useRatings(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.ratings).toEqual({});
  });
});
