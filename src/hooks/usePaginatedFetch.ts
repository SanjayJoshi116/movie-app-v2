import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";

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

  const didRestoreScrollRef = useRef(false);
  const isRestoringRef = useRef(restore.isReturning);
  const restoredStateRef = useRef(restoredState);
  const consumedFetchPageRef = useRef<typeof fetchPage | null>(null);

  useEffect(() => {
    let cancelled = false;

    // React 18 StrictMode (dev only) replays this effect once with the same
    // fetchPage reference to test cleanup-safety. A *real* rerun only ever
    // happens when fetchPage's identity actually changes (new query/filters),
    // so an identical reference here means "StrictMode's dev-only replay" —
    // state is already correct from the first pass, refetching would silently
    // clobber a successful restore (e.g. Search's cached items/scroll) with a
    // fresh page-1 fetch.
    if (consumedFetchPageRef.current === fetchPage) {
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        if (isRestoringRef.current && restoredStateRef.current) {
          const { items: cachedItems, hasMore: cachedHasMore } = restoredStateRef.current;
          setItems(cachedItems);
          setCurrentPage(restore.savedLoadedPages);
          setHasMore(cachedHasMore);
        } else if (isRestoringRef.current && restore.savedLoadedPages > 1) {
          const pages = Array.from({ length: restore.savedLoadedPages }, (_, i) => i + 1);
          const pageResults = await Promise.all(pages.map((p) => fetchPage(p)));
          if (cancelled) return;
          const combined = pageResults.flatMap((p) => p.results);
          const totalPages = pageResults[pageResults.length - 1]?.totalPages ?? 1;
          setItems(combined);
          setCurrentPage(restore.savedLoadedPages);
          setHasMore(restore.savedLoadedPages < totalPages);
        } else {
          const { results, totalPages } = await fetchPage(1);
          if (cancelled) return;
          setItems(results);
          setCurrentPage(1);
          setHasMore(1 < totalPages);
        }
      } catch (err) {
        console.error("Error fetching paginated data:", err);
      } finally {
        if (!cancelled) setLoading(false);
        isRestoringRef.current = false;
        consumedFetchPageRef.current = fetchPage;
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  useLayoutEffect(() => {
    if (restore.isReturning && restore.savedScrollY > 0 && !didRestoreScrollRef.current && items.length > 0) {
      didRestoreScrollRef.current = true;
      window.scrollTo(0, restore.savedScrollY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const { results, totalPages } = await fetchPage(nextPage);
      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const deduped = results.filter((item) => !existingIds.has(item.id));
        return [...prev, ...deduped];
      });
      setCurrentPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, currentPage, hasMore, loadingMore]);

  return { items, setItems, currentPage, hasMore, loading, loadingMore, loadMore };
}
