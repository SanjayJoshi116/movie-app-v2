import { createContext, createElement, useContext, useMemo, useRef, useState, useEffect, useCallback, ReactNode } from "react";
import {
  currentSessionGeneration,
  fetchNewReleaseNotifications,
  isCurrentSession,
  markNotificationsSeen,
} from "../api/userApi";
import type { NewReleaseNotification } from "../api/userApi";
import { useAuth } from "../context/AuthContext";
import { FollowedPeopleContext } from "../context/FollowedPeopleContext";

const POLL_INTERVAL_MS = 3 * 60 * 1000;
/** Follow changes this close together cause one refresh (People: follow ten in a row). */
export const FOLLOW_REFRESH_DEBOUNCE_MS = 1500;

function useNotificationsState() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NewReleaseNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  // Bumped by markSeen. A poll that started before the latest mark-seen would
  // otherwise bring the badge back with the server's pre-mark answer.
  const seenEpochRef = useRef(0);
  // Only the latest refresh may apply: an earlier one that answers last (a
  // poll, or the refresh for a previous follow) would replace newer results.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    // A poll still in flight at sign-out answers for the previous account:
    // its items reveal whom that account follows.
    const gen = currentSessionGeneration();
    const seenEpoch = seenEpochRef.current;
    const requestId = ++requestIdRef.current;
    try {
      const { data } = await fetchNewReleaseNotifications();
      if (!isCurrentSession(gen) || seenEpoch !== seenEpochRef.current || requestId !== requestIdRef.current) return;
      // Defensive: an unmocked/misconfigured route or unexpected backend
      // response could return something other than {items, unreadCount} —
      // fall back rather than let a downstream .map() throw on undefined.
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setHasError(false);
    } catch {
      if (!isCurrentSession(gen) || requestId !== requestIdRef.current) return;
      // Background poll — no toast (would be noisy every 3 min if TMDB is
      // rate-limited), but surface it in the dropdown so it's not silently
      // invisible forever.
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      setHasError(false);
      return;
    }
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  // A follow or unfollow (or a restore) changes what's news: refresh soon,
  // not at the next 3-minute tick. Debounced, so a burst of follows is one
  // request and stays under the notifications rate limit. Read straight from
  // the context, because useFollowedPeople() would start that provider's lazy fetch.
  const followChanges = useContext(FollowedPeopleContext)?.changes ?? 0;
  const seenFollowChanges = useRef(followChanges);
  useEffect(() => {
    if (followChanges === seenFollowChanges.current) return;
    seenFollowChanges.current = followChanges;
    if (!isAuthenticated) return;
    const timer = setTimeout(refresh, FOLLOW_REFRESH_DEBOUNCE_MS);
    // A newer change restarts the wait; sign-out or unmount drops it.
    return () => clearTimeout(timer);
  }, [followChanges, isAuthenticated, refresh]);

  const markSeen = useCallback(async () => {
    seenEpochRef.current += 1;
    setUnreadCount(0);
    setItems((prev) => prev.map((i) => ({ ...i, isUnread: false })));
    try {
      await markNotificationsSeen();
    } catch {
      // best-effort — a failed mark-seen just means the badge may reappear next poll
    } finally {
      // Again once the server has it: a poll that started while the POST was in
      // flight can still get the pre-mark answer.
      seenEpochRef.current += 1;
    }
  }, []);

  return useMemo(() => ({ items, unreadCount, hasError, markSeen }), [items, unreadCount, hasError, markSeen]);
}

type NotificationsContextType = ReturnType<typeof useNotificationsState>;

const NotificationsContext = createContext<NotificationsContextType | null>(null);

/**
 * Single poller for the whole app. The bell is mounted in both Sidebar and
 * BottomNav (CSS hides one per breakpoint); with a hook instance each they ran
 * two pollers whose badges could disagree.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotificationsState();
  return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications(): NotificationsContextType {
  const ctx = useContext(NotificationsContext);
  if (ctx === null) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
