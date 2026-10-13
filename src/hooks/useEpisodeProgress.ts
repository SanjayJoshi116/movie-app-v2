import { useState, useEffect, useCallback, useRef } from "react";
import { getEpisodeProgress, setEpisodeProgress, deleteEpisodeProgress, type EpisodeProgressData } from "../api/userApi";
import { useAuth } from "../context/AuthContext";
import { createInflight } from "../utils/inflight";

export function useEpisodeProgress(showId: number) {
  const { isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<EpisodeProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  // A failed load is not "no progress": offering to start tracking then would
  // let a save overwrite the stored position with S1E1.
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(createInflight());
  const showIdRef = useRef(showId);
  showIdRef.current = showId;

  useEffect(() => {
    // Never show the previous show's progress (or a logged-out user's).
    setProgress(null);
    setError(false);
    if (!isAuthenticated || !showId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getEpisodeProgress(showId)
      .then((res) => { if (!cancelled) setProgress(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showId, isAuthenticated, retryToken]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  // One write per show at a time: a double click on Next or Save settles with
  // the first request instead of sending a second. Writes resolve after the
  // user may have navigated to another show; only apply the result if it's
  // still the one on screen.
  const write = useCallback(
    <T,>(fn: () => Promise<T>) =>
      inflight.current.run(`progress-${showId}`, async () => {
        setBusy(true);
        try {
          return await fn();
        } finally {
          if (showIdRef.current === showId) setBusy(false);
        }
      }),
    [showId]
  );

  const update = useCallback(
    (season: number, episode: number) =>
      write(async () => {
        const res = await setEpisodeProgress(showId, season, episode);
        if (showIdRef.current === showId) setProgress(res.data);
      }),
    [showId, write]
  );

  const clear = useCallback(
    () =>
      write(async () => {
        await deleteEpisodeProgress(showId);
        if (showIdRef.current === showId) setProgress(null);
      }),
    [showId, write]
  );

  return { progress, loading, error, retry, busy, update, clear };
}
