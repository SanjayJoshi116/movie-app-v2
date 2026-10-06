import { createContext, createElement, useContext, useMemo, useState, useEffect, useCallback, ReactNode } from "react";
import { fetchNewReleaseNotifications, markNotificationsSeen } from "../api/userApi";
import type { NewReleaseNotification } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL_MS = 3 * 60 * 1000;

function useNotificationsState() {
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
