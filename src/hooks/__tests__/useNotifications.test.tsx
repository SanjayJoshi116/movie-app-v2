import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { fetchNewReleaseNotifications, markNotificationsSeen } from "../../api/userApi";
import { NotificationsProvider, useNotifications } from "../useNotifications";
import { AuthContext } from "../../context/AuthContext";
import { FollowedPeopleContext, type FollowedPeopleContextType } from "../../context/FollowedPeopleContext";

jest.mock("../../api/userApi", () => {
  const actual = jest.requireActual("../../api/userApi");
  return {
    ...actual,
    __esModule: true,
    default: { get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } },
    fetchNewReleaseNotifications: jest.fn(),
    markNotificationsSeen: jest.fn(),
  };
});

const mockPoll = fetchNewReleaseNotifications as jest.Mock;
const mockMarkSeen = markNotificationsSeen as jest.Mock;

const auth = {
  user: { id: 1, username: "u", email: "", first_name: "", last_name: "", is_staff: false, avatar_url: null },
  isLoading: false, isAuthenticated: true,
  login: jest.fn(), register: jest.fn(), logout: jest.fn(), updateProfile: jest.fn(), setUserData: jest.fn(),
};
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthContext.Provider, { value: auth }, React.createElement(NotificationsProvider, null, children));

const unread = {
  items: [{ id: 1, type: "movie", title: "New One", posterPath: null, releaseDate: "2026-10-01", personName: "P", isUnread: true }],
  unreadCount: 1,
};

describe("useNotifications", () => {
  beforeEach(() => {
    mockPoll.mockReset();
    mockMarkSeen.mockReset().mockResolvedValue({});
  });

  it("ignores a poll that was in flight when the user marked seen", async () => {
    let resolvePoll!: (v: unknown) => void;
    mockPoll.mockReturnValueOnce(new Promise((res) => { resolvePoll = res; }));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(1));

    await act(async () => { await result.current.markSeen(); });
    await act(async () => { resolvePoll({ data: unread }); });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.items).toEqual([]);
  });

  it("applies a poll when nothing was marked seen meanwhile", async () => {
    mockPoll.mockResolvedValue({ data: unread });
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(result.current.items[0]?.isUnread).toBe(true);
  });
});

describe("refresh after a follow change", () => {
  beforeEach(() => mockPoll.mockReset().mockResolvedValue({ data: { items: [], unreadCount: 0 } }));

  it("polls again when the followed-people change counter moves, not on mount", async () => {
    const followCtx = (changes: number) => ({ changes } as unknown as FollowedPeopleContextType);
    let changes = 0;
    const withFollows = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthContext.Provider, { value: auth },
        React.createElement(
          FollowedPeopleContext.Provider, { value: followCtx(changes) },
          React.createElement(NotificationsProvider, null, children),
        ),
      );
    const { rerender } = renderHook(() => useNotifications(), { wrapper: withFollows });
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(1));

    changes = 1;
    rerender();
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(2));
  });
});
