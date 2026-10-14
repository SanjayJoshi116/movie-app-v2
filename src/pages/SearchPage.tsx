import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Typography, Tabs, Empty, theme } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import SkeletonCard from "../components/SkeletonCard";
import { LoadMoreError } from "../components/LoadMoreError";
import { LoadError } from "../components/LoadError";
import PersonCard from "../components/PersonCard";
import Movie from "../components/Movie";
import TVShowCard from "../components/TVShowCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import type { LocationRestore } from "../hooks/usePaginatedFetch";
import { searchMovies, searchTV, searchPeople } from "../api/tmdb";
import { saveSessionCache } from "../api/userApi";
import type { TMDBMovieSummary, TMDBTVSummary, TMDBPersonSummary } from "../types";
import { pageVariants } from "../constants/ui";
import { pageableTotal } from "../utils/tmdbPages";
import { pickKey } from "../utils/queryParams";

// ── Shared paginated hook ────────────────────────────────────────────────────

/**
 * Scroll to `y`, retrying for a few frames while the page is still too short
 * to reach it (a freshly shown tab pane can lay out after the first attempt,
 * and the browser would otherwise clamp the position for good).
 */
function scrollToWhenReady(y: number, frames = 30) {
  window.scrollTo(0, y);
  if (frames > 0 && Math.abs(window.scrollY - y) > 1) {
    requestAnimationFrame(() => scrollToWhenReady(y, frames - 1));
  }
}

interface SearchCache<T> {
  query: string;
  adult: boolean;
  items: T[];
  page: number;
  hasMore: boolean;
  scrollY: number;
}

function readCache<T>(cacheKey: string, query: string, adult: boolean): SearchCache<T> | null {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed: SearchCache<T> = JSON.parse(raw);
    if (parsed.query !== query || parsed.adult !== adult) return null;
    return parsed;
  } catch { return null; }
}

function usePaginatedSearch<T extends { id: number }>(
  fetcher: (query: string, page: number, adult: boolean) => Promise<{ results: T[]; totalPages: number }>,
  query: string,
  adult: boolean,
  cacheKey: string,
  active: boolean,
) {
  // Frozen at mount, same as the pre-merge implementation — a query change
  // after mount always goes through a normal fetch, only the very first
  // load (if it matches a cached search) skips the network entirely.
  const cache = useState(() => readCache<T>(cacheKey, query, adult))[0];
  const restore = useState<LocationRestore>(() => ({
    isReturning: !!cache,
    savedLoadedPages: cache?.page ?? 1,
    savedScrollY: cache?.scrollY ?? 0,
  }))[0];
  const restoredState = useState(() =>
    cache ? { items: cache.items, hasMore: cache.hasMore } : undefined
  )[0];

  useEffect(() => {
    if (!query) sessionStorage.removeItem(cacheKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // fetcher is a fresh inline closure on every render of the calling tab —
  // keep it out of fetchPage's deps (via a ref) so a re-render doesn't look
  // like a new fetchPage identity and retrigger usePaginatedFetch's effect.
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });

  const fetchPage = useCallback(
    (page: number) =>
      query ? fetcherRef.current(query, page, adult) : Promise.resolve({ results: [], totalPages: 0 }),
    [query, adult]
  );

  const { items, currentPage, hasMore, loading, loadingMore, loadMore, error, retry, loadMoreError, retryLoadMore } = usePaginatedFetch<T>({
    fetchPage,
    restore,
    restoredState,
  });

  // Keep a ref with latest state so unmount cleanup captures current values
  const stateRef = useRef({ query, adult, items, page: currentPage, hasMore });
  useEffect(() => { stateRef.current = { query, adult, items, page: currentPage, hasMore }; });

  // Each tab tracks its own scroll position, only while it's the active tab.
  // Every visited tab stays mounted, so saving window.scrollY at unmount gave
  // every tab the active tab's position. Layout effect so the listener is
  // detached in the same commit as a tab switch, before the browser fires the
  // scroll event for the content-height change.
  const scrollYRef = useRef(cache?.scrollY ?? 0);
  useLayoutEffect(() => {
    if (!active) return;
    const onScroll = () => { scrollYRef.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [active]);

  // Switching back to an already-mounted tab restores where it was left.
  const wasActiveRef = useRef(active);
  useLayoutEffect(() => {
    if (active && !wasActiveRef.current) scrollToWhenReady(scrollYRef.current);
    wasActiveRef.current = active;
  }, [active]);

  // Save to sessionStorage on unmount
  useEffect(() => {
    return () => {
      const { query: q, adult: a, items: i, page: p, hasMore: h } = stateRef.current;
      if (q && i.length > 0) {
        saveSessionCache(cacheKey, JSON.stringify({ query: q, adult: a, items: i, page: p, hasMore: h, scrollY: scrollYRef.current }));
      }
    };
  }, [cacheKey]);

  // Restore scroll after cache-restored items render
  const scrollRestored = useRef(false);
  useLayoutEffect(() => {
    if (cache && !scrollRestored.current && items.length > 0) {
      scrollRestored.current = true;
      scrollToWhenReady(cache.scrollY);
    }
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading, loadingMore, hasMore, loadMore, error, retry, loadMoreError, retryLoadMore };
}

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

interface TabProps {
  query: string;
  adult: boolean;
  active: boolean;
}

function MoviesTab({ query, adult, active }: TabProps) {
  const navigate = useNavigate();
  const { items, loading, loadingMore, hasMore, loadMore, error, retry, loadMoreError, retryLoadMore } = usePaginatedSearch(
    async (q, p, a) => {
      const res = await searchMovies(q, p, a);
      return { results: res.data.results, totalPages: pageableTotal(res.data.total_pages) };
    },
    query,
    adult,
    "cinedb_search_movies",
    active,
  );
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore && !loadMoreError);

  if (loading) return <SkeletonCard count={12} />;
  if (error && !items.length) return <LoadError onRetry={retry} />;
  if (!items.length) return <Empty description={`No movies found for "${query}"`} style={{ padding: "40px 0" }} />;

  // The browse grids' card: same watched/watchlist controls, named per title.
  return (
    <>
      <Row gutter={[16, 20]}>
        {items.map((m: TMDBMovieSummary) => (
          <Col key={m.id} xs={12} sm={8} md={6} lg={4}>
            <Movie movie={m} onKnowMore={(id: number) => navigate(`/movie/${id}`)} />
          </Col>
        ))}
      </Row>
      {loadingMore && <div style={{ marginTop: 16 }}><SkeletonCard count={6} /></div>}
      {loadMoreError != null && !loadingMore && <LoadMoreError error={loadMoreError} onRetry={retryLoadMore} />}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  );
}

function TVTab({ query, adult, active }: TabProps) {
  const navigate = useNavigate();
  const { items, loading, loadingMore, hasMore, loadMore, error, retry, loadMoreError, retryLoadMore } = usePaginatedSearch(
    async (q, p, a) => {
      const res = await searchTV(q, p, a);
      return { results: res.data.results, totalPages: pageableTotal(res.data.total_pages) };
    },
    query,
    adult,
    "cinedb_search_tv",
    active,
  );
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore && !loadMoreError);

  if (loading) return <SkeletonCard count={12} />;
  if (error && !items.length) return <LoadError onRetry={retry} />;
  if (!items.length) return <Empty description={`No TV shows found for "${query}"`} style={{ padding: "40px 0" }} />;

  // The browse grids' card: same watched/watchlist controls, named per title.
  return (
    <>
      <Row gutter={[16, 20]}>
        {items.map((t: TMDBTVSummary) => (
          <Col key={t.id} xs={12} sm={8} md={6} lg={4}>
            <TVShowCard tvShow={t} onKnowMore={(id: number) => navigate(`/tv/${id}`)} />
          </Col>
        ))}
      </Row>
      {loadingMore && <div style={{ marginTop: 16 }}><SkeletonCard count={6} /></div>}
      {loadMoreError != null && !loadingMore && <LoadMoreError error={loadMoreError} onRetry={retryLoadMore} />}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  );
}

function PeopleTab({ query, adult, active }: TabProps) {
  const navigate = useNavigate();
  const { items, loading, loadingMore, hasMore, loadMore, error, retry, loadMoreError, retryLoadMore } = usePaginatedSearch(
    async (q, p, a) => {
      const res = await searchPeople(q, p, a);
      return { results: res.data.results, totalPages: pageableTotal(res.data.total_pages) };
    },
    query,
    adult,
    "cinedb_search_people",
    active,
  );
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore && !loadMoreError);

  if (loading) return <SkeletonCard count={12} />;
  if (error && !items.length) return <LoadError onRetry={retry} />;
  if (!items.length) return <Empty description={`No people found for "${query}"`} style={{ padding: "40px 0" }} />;

  return (
    <>
      <Row gutter={[16, 20]}>
        {items.map((p: TMDBPersonSummary) => (
          <Col key={p.id} xs={12} sm={8} md={6} lg={4}>
            <PersonCard person={p} onClick={() => navigate(`/person/${p.id}`)} />
          </Col>
        ))}
      </Row>
      {loadingMore && <div style={{ marginTop: 16 }}><SkeletonCard count={6} /></div>}
      {loadMoreError != null && !loadingMore && <LoadMoreError error={loadMoreError} onRetry={retryLoadMore} />}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function SearchPage() {
  const { token } = theme.useToken();
  const { searchTerm, setSearchTerm, includeAdult } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = pickKey(searchParams.get("tab"), ["movies", "tv", "people"], "movies");
  const urlQuery = searchParams.get("q")?.trim() ?? "";

  // The URL carries the search, so a reload, a shared link or a return from
  // login shows it. Layout effect: the tabs read searchTerm in their first effects.
  useLayoutEffect(() => {
    if (urlQuery) setSearchTerm(urlQuery);
  }, [urlQuery, setSearchTerm]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Search Results
      </Typography.Title>
      {searchTerm && (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
          Results for &ldquo;{searchTerm}&rdquo;
        </Typography.Text>
      )}

      {!searchTerm ? (
        <Empty
          image={<SearchOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
          description="Type something in the search bar to find movies, TV shows, or people."
          style={{ padding: "80px 0" }}
        />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams(
            (prev) => { const next = new URLSearchParams(prev); next.set("tab", key); return next; },
            { replace: true },
          )}
          items={[
            { key: "movies", label: "Movies", children: <MoviesTab query={searchTerm} adult={includeAdult} active={activeTab === "movies"} /> },
            { key: "tv", label: "TV Shows", children: <TVTab query={searchTerm} adult={includeAdult} active={activeTab === "tv"} /> },
            { key: "people", label: "People", children: <PeopleTab query={searchTerm} adult={includeAdult} active={activeTab === "people"} /> },
          ]}
        />
      )}
    </motion.div>
  );
}

export default SearchPage;
