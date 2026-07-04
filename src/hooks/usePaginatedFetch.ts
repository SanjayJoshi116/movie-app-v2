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

interface Options<T> {
  fetchPage: (page: number) => Promise<PageResult<T>>;
  restore: LocationRestore;
}

/**
 * Shared "fetch page 1, infinite-scroll loadMore, restore N pages + scroll
 * position when returning via router location.state" logic used by the
 * browse-style pages (Home, Anime, People).
 */
export function usePaginatedFetch<T extends { id: number }>({ fetchPage, restore }: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const didRestoreScrollRef = useRef(false);
  const isRestoringRef = useRef(restore.isReturning);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (isRestoringRef.current && restore.savedLoadedPages > 1) {
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
