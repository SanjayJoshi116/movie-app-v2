import { useState, useEffect, useCallback } from "react";
import { fetchNewReleaseNotifications, markNotificationsSeen } from "../api/userApi";
import type { NewReleaseNotification } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL_MS = 3 * 60 * 1000;

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NewReleaseNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await fetchNewReleaseNotifications();
      // Defensive: an unmocked/misconfigured route or unexpected backend
      // response could return something other than {items, unreadCount} —
      // fall back rather than let a downstream .map() throw on undefined.
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setHasError(false);
    } catch {
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
      return;
    }
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  const markSeen = useCallback(async () => {
    setUnreadCount(0);
    setItems((prev) => prev.map((i) => ({ ...i, isUnread: false })));
    try {
      await markNotificationsSeen();
    } catch {
      // best-effort — a failed mark-seen just means the badge may reappear next poll
    }
  }, []);

  return { items, unreadCount, hasError, markSeen };
}
