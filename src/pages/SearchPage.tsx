import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Button, Tooltip, Typography, Tabs, Empty } from "antd";
import { EyeOutlined, EyeFilled, UserOutlined, SearchOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import SkeletonCard from "../components/SkeletonCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { searchMovies, searchTV, searchPeople } from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary, TMDBPersonSummary } from "../types";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function getRatingColor(v: number) {
  if (v >= 8) return "#52c41a";
  if (v >= 5) return "#faad14";
  return "#ff4d4f";
}

// ── Shared paginated hook ────────────────────────────────────────────────────

function usePaginatedSearch<T extends { id: number }>(
  fetcher: (query: string, page: number, adult: boolean) => Promise<{ results: T[]; totalPages: number }>,
  query: string,
  adult: boolean,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!query) {
      setItems([]);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetcher(query, 1, adult)
      .then(({ results, totalPages }) => {
        if (cancelled) return;
        setItems(results);
        setPage(1);
        setHasMore(totalPages > 1);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, adult]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !query) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const { results, totalPages } = await fetcher(query, next, adult);
      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        return [...prev, ...results.filter((item) => !existingIds.has(item.id))];
      });
      setPage(next);
      setHasMore(next < totalPages);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, page, query, adult]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading, loadingMore, hasMore, loadMore };
}

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function MoviesTab({ query, adult }: { query: string; adult: boolean }) {
  const navigate = useNavigate();
  const { isWatched, toggleWatched, theme } = useAppContext();
  const { showSuccess } = useToast();
  const { items, loading, loadingMore, hasMore, loadMore } = usePaginatedSearch(
    async (q, p, a) => {
      const res = await searchMovies(q, p, a);
      return { results: res.data.results, totalPages: Math.min(res.data.total_pages, 500) };
    },
    query,
    adult,
  );
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  if (loading) return <Row gutter={[16, 20]}><SkeletonCard count={12} /></Row>;
  if (!items.length) return <Empty description={`No movies found for "${query}"`} style={{ padding: "40px 0" }} />;

  return (
    <>
      <Row gutter={[16, 20]}>
        {items.map((m: TMDBMovieSummary) => (
          <Col key={m.id} xs={12} sm={8} md={6} lg={4}>
            <motion.div
              role="article"
              whileHover={{ scale: 1.04, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/movie/${m.id}`)}
            >
              <Card
                hoverable
                className="glass-card"
                cover={
                  <img
                    src={m.poster_path ? `${IMG_URL}${m.poster_path}` : "https://placehold.co/500x750?text=No+Image"}
                    alt={m.title}
                    loading="lazy"
                    className="movie-poster-img"
                  />
                }
                styles={{ body: { padding: "10px 12px" } }}
                style={{ height: "100%" }}
              >
                <Card.Meta
                  title={<span style={{ fontSize: 13, lineHeight: "1.3", display: "block" }}>{m.title}</span>}
                  description={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Tag color={getRatingColor(m.vote_average)} style={{ margin: 0 }}>
                        ★ {m.vote_average.toFixed(1)}
                      </Tag>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Tooltip title={isWatched(m.id, "movie") ? "Unmark watched" : "Mark as watched"}>
                          <Button
                            size="small"
                            type="text"
                            icon={isWatched(m.id, "movie") ? <EyeFilled /> : <EyeOutlined />}
                            style={{ color: isWatched(m.id, "movie") ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const already = isWatched(m.id, "movie");
                              toggleWatched({ id: m.id, type: "movie", title: m.title, posterPath: m.poster_path, voteAverage: m.vote_average });
                              showSuccess(already ? "Removed from watched" : "Marked as watched");
                            }}
                            aria-label={isWatched(m.id, "movie") ? "Unmark watched" : "Mark as watched"}
                          />
                        </Tooltip>
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          onClick={(e) => { e.stopPropagation(); navigate(`/movie/${m.id}`); }}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  }
                />
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
      {loadingMore && <Row gutter={[16, 20]} style={{ marginTop: 16 }}><SkeletonCard count={6} /></Row>}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  );
}

function TVTab({ query, adult }: { query: string; adult: boolean }) {
  const navigate = useNavigate();
  const { isWatched, toggleWatched, theme } = useAppContext();
  const { showSuccess } = useToast();
  const { items, loading, loadingMore, hasMore, loadMore } = usePaginatedSearch(
    async (q, p, a) => {
      const res = await searchTV(q, p, a);
      return { results: res.data.results, totalPages: Math.min(res.data.total_pages, 500) };
    },
    query,
    adult,
  );
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  if (loading) return <Row gutter={[16, 20]}><SkeletonCard count={12} /></Row>;
  if (!items.length) return <Empty description={`No TV shows found for "${query}"`} style={{ padding: "40px 0" }} />;

  return (
    <>
      <Row gutter={[16, 20]}>
        {items.map((t: TMDBTVSummary) => (
          <Col key={t.id} xs={12} sm={8} md={6} lg={4}>
            <motion.div
              role="article"
              whileHover={{ scale: 1.04, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/tv/${t.id}`)}
            >
              <Card
                hoverable
                className="glass-card"
                cover={
                  <img
                    src={t.poster_path ? `${IMG_URL}${t.poster_path}` : "https://placehold.co/500x750?text=No+Image"}
                    alt={t.name}
                    loading="lazy"
                    className="movie-poster-img"
                  />
                }
                styles={{ body: { padding: "10px 12px" } }}
                style={{ height: "100%" }}
              >
                <Card.Meta
                  title={<span style={{ fontSize: 13, lineHeight: "1.3", display: "block" }}>{t.name}</span>}
                  description={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Tag color={getRatingColor(t.vote_average)} style={{ margin: 0 }}>
                        ★ {t.vote_average.toFixed(1)}
                      </Tag>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Tooltip title={isWatched(t.id, "tv") ? "Unmark watched" : "Mark as watched"}>
                          <Button
                            size="small"
                            type="text"
                            icon={isWatched(t.id, "tv") ? <EyeFilled /> : <EyeOutlined />}
                            style={{ color: isWatched(t.id, "tv") ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const already = isWatched(t.id, "tv");
                              toggleWatched({ id: t.id, type: "tv", title: t.name, posterPath: t.poster_path, voteAverage: t.vote_average });
                              showSuccess(already ? "Removed from watched" : "Marked as watched");
                            }}
                            aria-label={isWatched(t.id, "tv") ? "Unmark watched" : "Mark as watched"}
                          />
                        </Tooltip>
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          onClick={(e) => { e.stopPropagation(); navigate(`/tv/${t.id}`); }}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  }
                />
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
      {loadingMore && <Row gutter={[16, 20]} style={{ marginTop: 16 }}><SkeletonCard count={6} /></Row>}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  );
}

function PeopleTab({ query, adult }: { query: string; adult: boolean }) {
  const navigate = useNavigate();
  const { items, loading, loadingMore, hasMore, loadMore } = usePaginatedSearch(
    async (q, p, a) => {
      const res = await searchPeople(q, p, a);
      return { results: res.data.results, totalPages: Math.min(res.data.total_pages, 500) };
    },
    query,
    adult,
  );
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  if (loading) return <Row gutter={[16, 20]}><SkeletonCard count={12} /></Row>;
  if (!items.length) return <Empty description={`No people found for "${query}"`} style={{ padding: "40px 0" }} />;

  return (
    <>
      <Row gutter={[16, 20]}>
        {items.map((p: TMDBPersonSummary) => (
          <Col key={p.id} xs={12} sm={8} md={6} lg={4}>
            <motion.div whileHover={{ scale: 1.04, y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <Card
                hoverable
                className="glass-card"
                onClick={() => navigate(`/person/${p.id}`)}
                cover={
                  <img
                    src={p.profile_path ? `${IMG_URL}${p.profile_path}` : "https://placehold.co/500x750?text=No+Image"}
                    alt={p.name}
                    loading="lazy"
                    className="movie-poster-img"
                  />
                }
                styles={{ body: { padding: "8px 10px" } }}
              >
                <Typography.Text strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  {p.name}
                </Typography.Text>
                {p.known_for_department && (
                  <Tag icon={<UserOutlined />} color="default" style={{ fontSize: 11 }}>
                    {p.known_for_department}
                  </Tag>
                )}
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
      {loadingMore && <Row gutter={[16, 20]} style={{ marginTop: 16 }}><SkeletonCard count={6} /></Row>}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function SearchPage() {
  const { searchTerm, includeAdult } = useAppContext();

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
          image={<SearchOutlined style={{ fontSize: 48, color: "#aaa" }} />}
          description="Type something in the search bar to find movies, TV shows, or people."
          style={{ padding: "80px 0" }}
        />
      ) : (
        <Tabs
          defaultActiveKey="movies"
          items={[
            { key: "movies", label: "Movies", children: <MoviesTab query={searchTerm} adult={includeAdult} /> },
            { key: "tv", label: "TV Shows", children: <TVTab query={searchTerm} adult={includeAdult} /> },
            { key: "people", label: "People", children: <PeopleTab query={searchTerm} adult={includeAdult} /> },
          ]}
        />
      )}
    </motion.div>
  );
}

export default SearchPage;
