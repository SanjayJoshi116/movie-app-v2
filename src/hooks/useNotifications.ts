import { useState, useEffect, useCallback } from "react";
import { fetchNewReleaseNotifications, markNotificationsSeen } from "../api/userApi";
import type { NewReleaseNotification } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL_MS = 3 * 60 * 1000;

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NewReleaseNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await fetchNewReleaseNotifications();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent — a failed background poll shouldn't surface an error toast
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

  return { items, unreadCount, markSeen };
}
