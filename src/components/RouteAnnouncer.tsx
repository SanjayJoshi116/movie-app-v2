import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { subscribePageTitle, type PageTitleEvent } from "../hooks/usePageTitle";

/** How long a page's final title must stay put before it's announced: a
 *  same-route param change (/movie/1 → /movie/2) first renders with the old
 *  name and only then switches to loading. */
export const ANNOUNCE_SETTLE_MS = 1000;

const visuallyHidden: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

/**
 * Tells assistive technology which page an in-app navigation opened: the
 * page's title, once it has settled, through a polite live region. Focus and
 * scroll are left alone, so restored scroll positions stay put.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  // What the page on screen last reported: null after a page unmounted (the
  // next one's code may still be loading), `loading` while its name isn't in.
  const latest = useRef<PageTitleEvent>(null);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // The initial load isn't a navigation. A path, not a "first run" flag, so
  // StrictMode's dev-only effect replay (same path) doesn't count as one.
  const lastPath = useRef(pathname);

  // Announce only a final title of the page the navigation opened: never the
  // previous page's (it clears on unmount) or a generic one still loading.
  function schedule() {
    clearTimeout(timer.current);
    if (pending.current && latest.current && !latest.current.loading) {
      timer.current = setTimeout(announce, ANNOUNCE_SETTLE_MS);
    }
  }

  function announce() {
    pending.current = false;
    if (latest.current) setMessage(latest.current.title);
  }

  useEffect(() => subscribePageTitle((event) => {
    latest.current = event;
    schedule();
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    pending.current = true;
    schedule();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="route-announcer" style={visuallyHidden}>
      {message}
    </div>
  );
}
