import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { subscribePageTitle } from "../hooks/usePageTitle";

/** How long after a navigation the title may still change (a detail page's
 *  name arrives after its fetch) before it's announced. */
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
  const latest = useRef(document.title);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const first = useRef(true);

  useEffect(() => subscribePageTitle((title) => {
    latest.current = title;
    if (!pending.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(announce, ANNOUNCE_SETTLE_MS);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  function announce() {
    pending.current = false;
    setMessage(latest.current);
  }

  useEffect(() => {
    if (first.current) { first.current = false; return; } // the initial load isn't a navigation
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(announce, ANNOUNCE_SETTLE_MS);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="route-announcer" style={visuallyHidden}>
      {message}
    </div>
  );
}
