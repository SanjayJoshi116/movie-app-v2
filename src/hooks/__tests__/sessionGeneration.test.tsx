import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi, {
  bindSessionUser,
  currentSessionGeneration,
  isCurrentSession,
  fetchNewReleaseNotifications,
  getFollowedPeople,
} from "../../api/userApi";
import { useWatched } from "../useWatched";
import { useLists } from "../useLists";
import { NotificationsProvider, useNotifications } from "../useNotifications";
import { AuthContext } from "../../context/AuthContext";
import { FollowedPeopleProvider } from "../../context/FollowedPeopleContext";
import { useFollowedPeople } from "../useFollowedPeople";

// The real generation functions; only the network is mocked.
jest.mock("../../api/userApi", () => {
  const actual = jest.requireActual("../../api/userApi");
  return {
    ...actual,
    __esModule: true,
    default: {
      get: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    },
    fetchNewReleaseNotifications: jest.fn(),
    markNotificationsSeen: jest.fn(),
    getFollowedPeople: jest.fn(),
  };
});

const mockGet = userApi.get as jest.Mock;
const mockNotifications = fetchNewReleaseNotifications as jest.Mock;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Auth state the tests switch by hand, the way AuthProvider does: bind first, then re-render. */
let authed = true;
function authValue() {
  return {
    user: authed ? { id: 1, username: "u", email: "", first_name: "", last_name: "", is_staff: false, avatar_url: null } : null,
    isLoading: false,
    isAuthenticated: authed,
    login: jest.fn(), register: jest.fn(), logout: jest.fn(), updateProfile: jest.fn(), setUserData: jest.fn(),
  };
}
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthContext.Provider, { value: authValue() }, children);

function switchAccount(rerender: () => void, nextId: number) {
  bindSessionUser(null);
  authed = false;
  rerender();
  bindSessionUser(nextId);
  authed = true;
  rerender();
}

const watchedDTO = (mediaId: number) => ({
  id: mediaId, mediaId, mediaType: "movie", title: `Title ${mediaId}`, posterPath: null,
  voteAverage: 7, watchedAt: "2026-10-01T00:00:00Z", watchedTz: "", runtimeMinutes: null, platform: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  authed = true;
  bindSessionUser(1);
});

describe("session generation", () => {
  it("changes when the bound account changes, not on a same-account re-bind", () => {
    const gen = currentSessionGeneration();
    bindSessionUser(1);
    expect(isCurrentSession(gen)).toBe(true);
    bindSessionUser(2);
    expect(isCurrentSession(gen)).toBe(false);
    const signedIn = currentSessionGeneration();
    bindSessionUser(null);
    expect(isCurrentSession(signedIn)).toBe(false);
  });
});

describe("a response for the previous account is dropped", () => {
  it("useWatched: A's late load doesn't show to B, nor end B's loading", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    mockGet.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(() => useWatched(), { wrapper });

    switchAccount(rerender, 2);
    await act(async () => { a.resolve({ data: [watchedDTO(550)] }); });
    expect(result.current.watchedList).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => { b.resolve({ data: [watchedDTO(13)] }); });
    expect(result.current.watchedList.map((e) => e.id)).toEqual([13]);
    expect(result.current.isLoading).toBe(false);
  });

  it("useWatched: B sees its own load error, not A's history", async () => {
    const a = deferred<unknown>();
    mockGet.mockReturnValueOnce(a.promise).mockRejectedValueOnce(new Error("B failed"));
    const { result, rerender } = renderHook(() => useWatched(), { wrapper });

    switchAccount(rerender, 2);
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    await act(async () => { a.resolve({ data: [watchedDTO(550)] }); });
    expect(result.current.watchedList).toEqual([]);
    expect((result.current.error as Error).message).toBe("B failed");
  });

  it("useWatched: A's late failure doesn't set B's error", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    mockGet.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(() => useWatched(), { wrapper });

    switchAccount(rerender, 2);
    await act(async () => { a.reject(new Error("A failed")); });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("useLists: A's late lists don't show to B", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    mockGet.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(() => useLists(), { wrapper });

    switchAccount(rerender, 2);
    await act(async () => {
      a.resolve({ data: [{ id: 1, name: "A's list", description: "", createdAt: "2026-10-01T00:00:00Z", items: [] }] });
    });
    expect(result.current.lists).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await act(async () => { b.resolve({ data: [] }); });
    expect(result.current.isLoading).toBe(false);
  });
});

describe("followed people across an account switch", () => {
  it("drops A's list when it lands after the session changed", async () => {
    const a = deferred<unknown>();
    const mockFollowed = getFollowedPeople as jest.Mock;
    mockFollowed.mockReturnValueOnce(a.promise);
    const followedWrapper = ({ children }: { children: React.ReactNode }) =>
      wrapper({ children: React.createElement(FollowedPeopleProvider, null, children) });
    const { result } = renderHook(() => useFollowedPeople(), { wrapper: followedWrapper });
    await waitFor(() => expect(mockFollowed).toHaveBeenCalled());

    // The sign-out binds a new session before the provider's effect cleanup runs.
    act(() => bindSessionUser(2));
    await act(async () => {
      a.resolve([{ id: 10, personId: 287, name: "A's follow", profilePath: null, followedAt: "2026-10-01T10:00:00Z" }]);
    });
    expect(result.current.followed).toEqual([]);
  });
});

describe("notifications across an account switch", () => {
  const notificationsWrapper = ({ children }: { children: React.ReactNode }) =>
    wrapper({ children: React.createElement(NotificationsProvider, null, children) });

  it("ignores A's in-flight poll once B is signed in", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    mockNotifications.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(() => useNotifications(), { wrapper: notificationsWrapper });

    switchAccount(rerender, 2);
    await act(async () => {
      a.resolve({ data: { items: [{ mediaId: 550, isUnread: true }], unreadCount: 1 } });
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.items).toEqual([]);

    await act(async () => { b.resolve({ data: { items: [], unreadCount: 0 } }); });
    expect(result.current.hasError).toBe(false);
  });

  it("clears the error flag on sign-out", async () => {
    mockNotifications.mockRejectedValueOnce(new Error("poll failed"));
    const { result, rerender } = renderHook(() => useNotifications(), { wrapper: notificationsWrapper });
    await waitFor(() => expect(result.current.hasError).toBe(true));

    bindSessionUser(null);
    authed = false;
    rerender();
    expect(result.current.hasError).toBe(false);
  });
});
