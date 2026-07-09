import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { AppProvider } from "../AppContext";
import { AuthContext } from "../AuthContext";
import { useAppContext } from "../useAppContext";
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
  React.createElement(
    AuthContext.Provider,
    { value: mockAuthValue },
    React.createElement(AppProvider, null, children)
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.className = "";
  mockGet.mockResolvedValue({ data: [] });
  mockPost.mockResolvedValue({ data: { id: 99, addedAt: new Date().toISOString(), ratedAt: new Date().toISOString() } });
  (userApi.delete as jest.Mock).mockResolvedValue({});
  (userApi.patch as jest.Mock).mockResolvedValue({});
});

describe("AppContext", () => {
  it("useAppContext() throws when used outside AppProvider", () => {
    expect(() => renderHook(() => useAppContext())).toThrow(
      "useAppContext must be used within AppProvider"
    );
  });

  it("AppProvider renders children", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));
    expect(result.current).toBeDefined();
  });

  it("theme defaults to 'dark' and body has dark-theme class", async () => {
    renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(document.body.classList.contains("dark-theme")).toBe(true);
  });

  it("toggleTheme() switches theme and updates body class", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));

    expect(result.current.theme).toBe("dark");
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe("light");
    expect(document.body.classList.contains("dark-theme")).toBe(false);
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe("dark");
    expect(document.body.classList.contains("dark-theme")).toBe(true);
  });

  it("setSearchTerm and clearSearch work correctly", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));

    act(() => { result.current.setSearchTerm("inception"); });
    expect(result.current.searchTerm).toBe("inception");
    act(() => { result.current.clearSearch(); });
    expect(result.current.searchTerm).toBe("");
  });

  it("toggleGenre adds then removes same id", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));

    act(() => { result.current.toggleGenre(28); });
    expect(result.current.selectedGenres).toContain(28);
    act(() => { result.current.toggleGenre(28); });
    expect(result.current.selectedGenres).not.toContain(28);
  });

  it("clearGenres empties the array", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));

    act(() => {
      result.current.toggleGenre(28);
      result.current.toggleGenre(12);
    });
    expect(result.current.selectedGenres).toHaveLength(2);
    act(() => { result.current.clearGenres(); });
    expect(result.current.selectedGenres).toHaveLength(0);
  });

  it("watchlist round-trip: add, isIn, remove", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));

    const entry: WatchlistInput = {
      id: 550, type: "movie", title: "Fight Club", posterPath: "/poster.jpg", voteAverage: 8.4,
    };

    await act(async () => { await result.current.addToWatchlist(entry); });
    expect(result.current.isInWatchlist(550, "movie")).toBe(true);
    expect(result.current.watchlist).toHaveLength(1);

    await act(async () => { await result.current.removeFromWatchlist(550, "movie"); });
    expect(result.current.isInWatchlist(550, "movie")).toBe(false);
    expect(result.current.watchlist).toHaveLength(0);
  });

  it("ratings round-trip: set, get, remove", async () => {
    const { result } = renderHook(() => useAppContext(), { wrapper });
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));

    await act(async () => { await result.current.setRating(550, "movie", "Fight Club", 10, "Masterpiece"); });
    const rating = result.current.getRating(550, "movie");
    expect(rating).not.toBeNull();
    expect(rating!.userRating).toBe(10);
    expect(rating!.review).toBe("Masterpiece");

    await act(async () => { await result.current.removeRating(550, "movie"); });
    expect(result.current.getRating(550, "movie")).toBeNull();
  });
});
