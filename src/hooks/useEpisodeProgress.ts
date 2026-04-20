import { useState, useEffect, useCallback } from "react";
import { getEpisodeProgress, setEpisodeProgress, deleteEpisodeProgress, type EpisodeProgressData } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

export function useEpisodeProgress(showId: number) {
  const { isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<EpisodeProgressData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !showId) return;
    setLoading(true);
    getEpisodeProgress(showId)
      .then((res) => setProgress(res.data))
      .catch(() => setProgress(null))
      .finally(() => setLoading(false));
  }, [showId, isAuthenticated]);

  const update = useCallback(
    async (season: number, episode: number) => {
      const res = await setEpisodeProgress(showId, season, episode);
      setProgress(res.data);
    },
    [showId]
  );

  const clear = useCallback(async () => {
    await deleteEpisodeProgress(showId);
    setProgress(null);
  }, [showId]);

  return { progress, loading, update, clear };
}
