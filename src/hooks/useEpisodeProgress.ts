import { useState, useEffect, useCallback, useRef } from "react";
import { getEpisodeProgress, setEpisodeProgress, deleteEpisodeProgress, type EpisodeProgressData } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

export function useEpisodeProgress(showId: number) {
  const { isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<EpisodeProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const showIdRef = useRef(showId);
  showIdRef.current = showId;

  useEffect(() => {
    // Never show the previous show's progress (or a logged-out user's).
    setProgress(null);
    if (!isAuthenticated || !showId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getEpisodeProgress(showId)
      .then((res) => { if (!cancelled) setProgress(res.data); })
      .catch(() => { if (!cancelled) setProgress(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showId, isAuthenticated]);

  // Writes resolve after the user may have navigated to another show; only
  // apply the result if it's still the one on screen.
  const update = useCallback(
    async (season: number, episode: number) => {
      const res = await setEpisodeProgress(showId, season, episode);
      if (showIdRef.current === showId) setProgress(res.data);
    },
    [showId]
  );

  const clear = useCallback(async () => {
    await deleteEpisodeProgress(showId);
    if (showIdRef.current === showId) setProgress(null);
  }, [showId]);

  return { progress, loading, update, clear };
}
