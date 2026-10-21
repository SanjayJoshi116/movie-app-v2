import { useState, useEffect, useCallback, useRef } from "react";
import {
  currentSessionGeneration,
  deleteEpisodeProgress,
  getEpisodeProgress,
  isCurrentSession,
  setEpisodeProgress,
  type EpisodeProgressData,
} from "../api/userApi";
import { useAuth } from "../context/AuthContext";

export function useEpisodeProgress(showId: number) {
  const { isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<EpisodeProgressData | null>(null);
  // A failed load is not "no progress": offering to start tracking then would
  // let a save overwrite the stored position with S1E1.
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  // The show (and retry) whose load last settled. Loading is derived from it,
  // so it's true from the first render for a show, before the effect runs:
  // otherwise that render reads as "no progress", and the Episode Guide (whose
  // effects run first) would show spoilers (spoiler-shield).
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = isAuthenticated && !!showId && settledKey !== `${showId}:${retryToken}`;
  const [busy, setBusy] = useState(false);
  // The latest write for each show: what it does, and when it settles.
  const pending = useRef(new Map<number, { op: string; promise: Promise<void> }>());
  const showIdRef = useRef(showId);
  showIdRef.current = showId;

  useEffect(() => {
    // Never show the previous show's progress (or a logged-out user's).
    setProgress(null);
    setError(false);
    if (!isAuthenticated || !showId) { setSettledKey(null); return; }
    let cancelled = false;
    getEpisodeProgress(showId)
      .then((res) => { if (!cancelled) setProgress(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setSettledKey(`${showId}:${retryToken}`); });
    return () => { cancelled = true; };
  }, [showId, isAuthenticated, retryToken]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  // One write per show at a time, in click order. Repeating the same write
  // while it's pending (a double click on Next or Save) settles with it
  // instead of sending a second. A different write (Remove while Next is
  // saving) waits for it and then runs, so it reports its own outcome; sharing
  // one slot made Remove say "removed" with Next's result. Writes resolve after
  // the user may have navigated to another show, or signed out; only apply
  // the result if it's still the one on screen, for the same session.
  const write = useCallback(
    (op: string, fn: (gen: number) => Promise<void>): Promise<void> => {
      const slots = pending.current;
      const last = slots.get(showId);
      if (last?.op === op) return last.promise;
      const gen = currentSessionGeneration();
      const run = async () => {
        if (isCurrentSession(gen) && showIdRef.current === showId) setBusy(true);
        await fn(gen);
      };
      const promise: Promise<void> = (last ? last.promise.catch(() => undefined).then(run) : run()).finally(() => {
        if (slots.get(showId)?.promise !== promise) return; // a later write is queued behind this one
        slots.delete(showId);
        if (isCurrentSession(gen) && showIdRef.current === showId) setBusy(false);
      });
      slots.set(showId, { op, promise });
      return promise;
    },
    [showId]
  );

  const update = useCallback(
    (season: number, episode: number) =>
      write(`update:${season}:${episode}`, async (gen) => {
        const res = await setEpisodeProgress(showId, season, episode);
        if (isCurrentSession(gen) && showIdRef.current === showId) setProgress(res.data);
      }),
    [showId, write]
  );

  const clear = useCallback(
    () =>
      write("clear", async (gen) => {
        await deleteEpisodeProgress(showId);
        if (isCurrentSession(gen) && showIdRef.current === showId) setProgress(null);
      }),
    [showId, write]
  );

  return { progress, loading, error, retry, busy, update, clear };
}
