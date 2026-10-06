import { useMemo } from "react";
import { App } from "antd";

export function useToast() {
  const { message } = App.useApp();

  // `key: msg` makes an identical message replace the visible one instead of
  // stacking a duplicate (e.g. a deduped double-click settling twice).
  // Memoized so callers can list these in hook deps without re-running every render.
  return useMemo(() => ({
    showSuccess: (msg: string) => message.success({ content: msg, key: msg, duration: 2 }),
    showError: (msg: string) => message.error({ content: msg, key: msg, duration: 3 }),
    showInfo: (msg: string) => message.info({ content: msg, key: msg, duration: 2 }),
  }), [message]);
}
