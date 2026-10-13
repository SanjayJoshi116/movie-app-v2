import type { NavigateFunction } from "react-router-dom";

/**
 * A detail or person page's Back. Returns to `from` when the app opened the
 * page with one; otherwise goes back in history only when there is an in-app
 * entry to go back to. React Router keeps an `idx` in history.state, 0 for
 * the first entry of this tab. Without one (a new tab, a bookmark, another
 * site) `navigate(-1)` would do nothing or leave the app, so it goes to the
 * page's section instead, replacing the orphan entry.
 */
export function goBack(
  navigate: NavigateFunction,
  { from, state, fallback }: { from?: string | null; state?: unknown; fallback: string },
): void {
  if (from) {
    navigate(from, { state });
    return;
  }
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number" && idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
