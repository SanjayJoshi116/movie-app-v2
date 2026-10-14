import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { fetchNewReleaseNotifications, markNotificationsSeen } from "../../api/userApi";
import { FOLLOW_REFRESH_DEBOUNCE_MS, NotificationsProvider, useNotifications } from "../useNotifications";
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

  it("ignores a poll that started while the mark-seen request was in flight", async () => {
    jest.useFakeTimers();
    try {
      mockPoll.mockResolvedValueOnce({ data: { items: [], unreadCount: 0 } });
      const { result } = renderHook(() => useNotifications(), { wrapper });
      await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(1));

      let finishMark!: (v: unknown) => void;
      mockMarkSeen.mockReturnValueOnce(new Promise((res) => { finishMark = res; }));
      let marking!: Promise<void>;
      act(() => { marking = result.current.markSeen(); });
      // The next scheduled poll starts after the click, before the server has the mark.
      let answerPoll!: (v: unknown) => void;
      mockPoll.mockReturnValueOnce(new Promise((res) => { answerPoll = res; }));
      act(() => { jest.advanceTimersByTime(3 * 60 * 1000); });
      expect(mockPoll).toHaveBeenCalledTimes(2);

      await act(async () => { finishMark({}); await marking; });
      await act(async () => { answerPoll({ data: unread }); });
      expect(result.current.unreadCount).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("applies a poll when nothing was marked seen meanwhile", async () => {
    mockPoll.mockResolvedValue({ data: unread });
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(result.current.items[0]?.isUnread).toBe(true);
  });
});

describe("refresh after a follow change", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPoll.mockReset().mockResolvedValue({ data: { items: [], unreadCount: 0 } });
  });
  afterEach(() => jest.useRealTimers());

  /** A FollowedPeopleContext whose change counter the test moves. */
  function renderWithFollows() {
    const state = { changes: 0 };
    const withFollows = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthContext.Provider, { value: auth },
        React.createElement(
          FollowedPeopleContext.Provider, { value: { changes: state.changes } as unknown as FollowedPeopleContextType },
          React.createElement(NotificationsProvider, null, children),
        ),
      );
    const view = renderHook(() => useNotifications(), { wrapper: withFollows });
    const change = () => { state.changes += 1; view.rerender(); };
    return { ...view, change };
  }

  it("polls again shortly after the followed-people change counter moves, not on mount", async () => {
    const { change } = renderWithFollows();
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(1));

    change();
    act(() => { jest.advanceTimersByTime(FOLLOW_REFRESH_DEBOUNCE_MS - 1); });
    expect(mockPoll).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(1); });
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(2));
  });

  it("refreshes once for a burst of follow changes", async () => {
    const { change } = renderWithFollows();
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 5; i++) {
      change();
      act(() => { jest.advanceTimersByTime(200); });
    }
    act(() => { jest.advanceTimersByTime(FOLLOW_REFRESH_DEBOUNCE_MS); });
    await waitFor(() => expect(mockPoll).toHaveBeenCalledTimes(2));
    act(() => { jest.advanceTimersByTime(FOLLOW_REFRESH_DEBOUNCE_MS * 2); });
    expect(mockPoll).toHaveBeenCalledTimes(2);
  });

  it("an earlier refresh that answers last doesn't replace the newer one", async () => {
    const answers: ((v: unknown) => void)[] = [];
    mockPoll.mockImplementation(() => new Promise((res) => { answers.push(res); }));
    const { result, change } = renderWithFollows();
    await waitFor(() => expect(answers).toHaveLength(1)); // the mount poll, still pending

    change();
    act(() => { jest.advanceTimersByTime(FOLLOW_REFRESH_DEBOUNCE_MS); });
    await waitFor(() => expect(answers).toHaveLength(2));

    await act(async () => { answers[1]!({ data: unread }); });
    await act(async () => { answers[0]!({ data: { items: [], unreadCount: 0 } }); });
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items).toHaveLength(1);
  });
});
