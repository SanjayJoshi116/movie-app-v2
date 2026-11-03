import { useMemo, useRef } from "react";

export interface LatestOnly {
  /** Starts an attempt. The returned check stays true until a later `start()` or a `cancel()`. */
  start(): () => boolean;
  /** Makes every attempt started so far stale (a dialog closing). */
  cancel(): void;
}

/**
 * Lets only the latest of overlapping async attempts apply its result: an
 * import dialog's file reads, where a slower earlier pick must not land over
 * a later one. Stable across renders.
 */
export function useLatestOnly(): LatestOnly {
  const counter = useRef(0);
  return useMemo(() => ({
    start() {
      const id = ++counter.current;
      return () => id === counter.current;
    },
    cancel() {
      counter.current++;
    },
  }), []);
}
