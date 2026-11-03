import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi, { currentSessionGeneration, isCurrentSession } from "../api/userApi";
import { fetchAllPages, LIBRARY_PAGE_SIZE } from "../utils/fetchAllPages";
import { createInflight } from "../utils/inflight";
import { guardedReload } from "../utils/guardedReload";
import type { RatingEntry, RatingEntryDTO, RatingsMap } from "../types";
import { titleKey } from "../utils/titleKey";


export function useRatings() {
  const { isAuthenticated } = useAuth();
  const [ratings, setRatings] = useState<RatingsMap>({});
  // The session generation of the last finished load. Until it's this
  // session's, ratings are loading, so the first render after sign-in never
  // reads as loaded and empty.
  const [loadedGen, setLoadedGen] = useState<number | null>(null);
  const [reloading, setReloading] = useState(false);
  const isLoading = isAuthenticated && (reloading || loadedGen !== currentSessionGeneration());
  // The session generation of the last successful load, kept across a failed
  // reload, so a page can tell "never loaded" apart from "the last reload failed".
  const [loadedOkGen, setLoadedOkGen] = useState<number | null>(null);
  const hasLoaded = isAuthenticated && loadedOkGen === currentSessionGeneration();
  const [error, setError] = useState<unknown>(null);
  // Bumped as each write settles: a reload that started earlier is rerun.
  const writeSeq = useRef(0);
  // Numbers each reload: only the newest one's result and outcome are applied.
  const reloadSeq = useRef(0);
  const inflight = useRef(createInflight({ onSettle: () => { writeSeq.current += 1; } }));
  const dbIdMap = useRef<Record<string, number>>({});
  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    // A response that lands after sign-out belongs to the previous account.
    const gen = currentSessionGeneration();
    setReloading(true);
    try {
      await guardedReload(
        writeSeq,
        () => fetchAllPages<RatingEntryDTO>(userApi, "/ratings/", { pageSize: LIBRARY_PAGE_SIZE }),
        (data) => {
          if (!isCurrentSession(gen)) return;
          const map: Record<string, number> = {};
          const ratingsMap: RatingsMap = {};
          data.forEach((item) => {
            const k = titleKey(item.mediaId, item.mediaType);
            map[k] = item.id;
            ratingsMap[k] = {
              id: item.mediaId,
              type: item.mediaType,
              title: item.title,
              userRating: item.userRating,
              review: item.review,
              ratedAt: item.ratedAt,
            };
          });
          dbIdMap.current = map;
          setRatings(ratingsMap);
          setError(null);
          setLoadedOkGen(gen);
        },
        {
          reloadSeq,
          // Only the newest of overlapping reloads ends the loading state.
          onSettled: () => {
            if (isCurrentSession(gen)) { setReloading(false); setLoadedGen(gen); }
          },
        },
      );
    } catch (err) {
      if (!isCurrentSession(gen)) return;
      // Keep whatever was already loaded; the page decides how to surface it.
      setError(err);
      throw err;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRatings({});
      dbIdMap.current = {};
      setError(null);
      setReloading(false);
      return;
    }
    reload().catch(() => { /* recorded in `error` */ });
  }, [isAuthenticated, reload]);

  const setRaw = useCallback(async (
    id: number,
    type: string,
    title: string,
    userRating: number,
    review: string,
  ) => {
    if (!isAuthenticated) return;
    const gen = currentSessionGeneration();
    const { data } = await userApi.post<RatingEntryDTO>("/ratings/", {
      mediaId: id,
      mediaType: type,
      title,
      userRating,
      review,
    });
    if (!isCurrentSession(gen)) return;
    const k = titleKey(id, type);
    dbIdMap.current[k] = data.id;
    setRatings((prev) => ({
      ...prev,
      [k]: {
        id,
        type: type as RatingEntry["type"],
        title,
        userRating,
        review,
        ratedAt: data.ratedAt,
      },
    }));
  }, [isAuthenticated]);

  const get = useCallback((id: number, type: string): RatingEntry | null =>
    ratingsRef.current[titleKey(id, type)] ?? null,
  []);

  const removeRaw = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const k = titleKey(id, type);
    const dbId = dbIdMap.current[k];
    if (dbId == null) return;
    const gen = currentSessionGeneration();
    await userApi.delete(`/ratings/${dbId}/`);
    if (!isCurrentSession(gen)) return;
    delete dbIdMap.current[k];
    setRatings((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, [isAuthenticated]);

  // One in-flight slot per title, like the other library hooks: saving the
  // same rating twice sends one request, and a different save or a remove
  // runs after the pending one with its own outcome.
  const set = useCallback(
    (id: number, type: string, title: string, userRating: number, review = "") =>
      inflight.current.run(titleKey(id, type), () => setRaw(id, type, title, userRating, review),
        `set:${userRating}:${review}`),
    [setRaw],
  );

  const remove = useCallback(
    (id: number, type: string) => inflight.current.run(titleKey(id, type), () => removeRaw(id, type), "remove"),
    [removeRaw],
  );

  return { ratings, isLoading, hasLoaded, error, set, get, remove, reload };
}
