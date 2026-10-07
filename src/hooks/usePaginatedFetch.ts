import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useToast } from "./useToast";
import { getApiError } from "../utils/apiError";

export interface PageResult<T> {
  results: T[];
  totalPages: number;
}

export interface LocationRestore {
  isReturning: boolean;
  savedLoadedPages: number;
  savedScrollY: number;
}

interface RestoredState<T> {
  items: T[];
  hasMore: boolean;
}

interface Options<T> {
  fetchPage: (page: number) => Promise<PageResult<T>>;
  restore: LocationRestore;
  /**
   * When set alongside restore.isReturning, seeds items/hasMore directly
   * from a caller-held cache instead of refetching restore.savedLoadedPages
   * pages over the network — used by SearchPage, which caches full result
   * arrays in sessionStorage itself (Home/Anime/People don't pass this and
   * keep the refetch-by-page-count behavior below unchanged).
   */
  restoredState?: RestoredState<T>;
}

/**
 * Shared "fetch page 1, infinite-scroll loadMore, restore N pages + scroll
 * position when returning via router location.state" logic used by the
 * browse-style pages (Home, Anime, People) and (via restoredState) SearchPage.
 */
export function usePaginatedFetch<T extends { id: number }>({ fetchPage, restore, restoredState }: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retryToken, setRetryToken] = useState(0);
  const { showError } = useToast();

  const didRestoreScrollRef = useRef(false);
  const isRestoringRef = useRef(restore.isReturning);
  const restoredStateRef = useRef(restoredState);
  // The load the mount effect last started (or finished), armed as soon as
  // it starts. See the StrictMode note in the effect.
  const inflightRef = useRef<{
    fetchPage: typeof fetchPage;
    retryToken: number;
    ctl: { cancelled: boolean };
    done: boolean;
  } | null>(null);
  // Bumped on every real (non-replay) page-1 load. A page response that
  // started under an older generation belongs to a previous query/category
  // and is dropped instead of appended.
  const generationRef = useRef(0);

  useEffect(() => {
    // React 18 StrictMode (dev only) runs this effect, its cleanup, and the
    // effect again, synchronously, with the same fetchPage. A *real* rerun
    // only ever happens when fetchPage's identity (new query/filters) or
    // retryToken changes, so an identical pair here is that replay. Refetching
    // would double every request and could clobber a restore (e.g. Search's
    // cached items/scroll) with a fresh page 1. The guard is armed when the
    // load *starts*: the replay arrives while the first load is still in
    // flight, so it revives that load (its cleanup had just cancelled it)
    // instead of starting a second one.
    const prev = inflightRef.current;
    if (prev && prev.fetchPage === fetchPage && prev.retryToken === retryToken) {
      if (prev.done) return;
      prev.ctl.cancelled = false;
      return () => { prev.ctl.cancelled = true; };
    }
    const ctl = { cancelled: false };
    const entry = { fetchPage, retryToken, ctl, done: false };
    inflightRef.current = entry;
    generationRef.current += 1;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isRestoringRef.current && restoredStateRef.current) {
          const { items: cachedItems, hasMore: cachedHasMore } = restoredStateRef.current;
          setItems(cachedItems);
          setCurrentPage(restore.savedLoadedPages);
          setHasMore(cachedHasMore);
        } else if (isRestoringRef.current && restore.savedLoadedPages > 1) {
          const pages = Array.from({ length: restore.savedLoadedPages }, (_, i) => i + 1);
          const pageResults = await Promise.all(pages.map((p) => fetchPage(p)));
          if (ctl.cancelled) return;
          const combined = pageResults.flatMap((p) => p.results);
          const totalPages = pageResults[pageResults.length - 1]?.totalPages ?? 1;
          setItems(combined);
          setCurrentPage(restore.savedLoadedPages);
          setHasMore(restore.savedLoadedPages < totalPages);
        } else {
          // New query/category: drop the previous one's results so they never
          // show under the new heading, during loading or after a failure.
          setItems([]);
          setHasMore(true);
          const { results, totalPages } = await fetchPage(1);
          if (ctl.cancelled) return;
          setItems(results);
          setCurrentPage(1);
          setHasMore(1 < totalPages);
        }
      } catch (err) {
        if (!ctl.cancelled) setError(err);
      } finally {
        if (!ctl.cancelled) setLoading(false);
        isRestoringRef.current = false;
        entry.done = true;
      }
    };

    load();
    return () => { ctl.cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, retryToken]);

  useLayoutEffect(() => {
    if (restore.isReturning && restore.savedScrollY > 0 && !didRestoreScrollRef.current && items.length > 0) {
      didRestoreScrollRef.current = true;
      window.scrollTo(0, restore.savedScrollY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const generation = generationRef.current;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const { results, totalPages } = await fetchPage(nextPage);
      if (generationRef.current !== generation) return;
      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const deduped = results.filter((item) => !existingIds.has(item.id));
        return [...prev, ...deduped];
      });
      setCurrentPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch (err) {
      // Keep the pages already shown; the next scroll can try again.
      if (generationRef.current === generation) showError(getApiError(err, "Couldn't load more results."));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, currentPage, hasMore, loading, loadingMore, showError]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  return { items, setItems, currentPage, hasMore, loading, loadingMore, loadMore, error, retry };
}
