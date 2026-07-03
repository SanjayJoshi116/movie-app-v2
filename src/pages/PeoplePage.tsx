import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import SkeletonCard from "../components/SkeletonCard";
import MarqueeTitle from "../components/MarqueeTitle";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { fetchPopularPeople, searchPeople } from "../api/tmdb";
import type { TMDBPersonSummary } from "../types";
import { pageVariants, IMG_URL } from "../constants/ui";

function PeoplePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchTerm, includeAdult } = useAppContext();

  const locationState = location.state as { scrollY?: number; loadedPages?: number; isReturn?: boolean } | null;
  const isReturning = locationState?.isReturn ?? false;
  const savedScrollY = locationState?.scrollY ?? 0;
  const savedLoadedPages = locationState?.loadedPages ?? 1;

  const [allPeople, setAllPeople] = useState<TMDBPersonSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const didRestoreRef = useRef(false);
  const isRestoringRef = useRef(isReturning);

  const fetchPage = useCallback(
    async (page: number): Promise<{ results: TMDBPersonSummary[]; totalPages: number }> => {
      const res = searchTerm
        ? await searchPeople(searchTerm, page, includeAdult)
        : await fetchPopularPeople(page);
      return {
        results: res.data.results,
        totalPages: Math.min(res.data.total_pages, 500),
      };
    },
    [searchTerm, includeAdult]
  );

  // Initial load / refetch when search term or adult filter changes
  useEffect(() => {
    isRestoringRef.current = isReturning;
    let cancelled = false;

    const initialPages = isReturning ? savedLoadedPages : 1;

    const load = async () => {
      setLoading(true);
      try {
        const pages = await Promise.all(
          Array.from({ length: initialPages }, (_, i) => fetchPage(i + 1))
        );
        if (cancelled) return;
        const combined = pages.flatMap((p) => p.results);
        const totalPages = pages[pages.length - 1]?.totalPages ?? 1;
        setAllPeople(combined);
        setCurrentPage(initialPages);
        setHasMore(initialPages < totalPages);
      } catch {
        if (!cancelled) setAllPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore scroll position when returning from a person page
  useLayoutEffect(() => {
    if (isReturning && !loading && allPeople.length > 0 && !didRestoreRef.current) {
      didRestoreRef.current = true;
      window.scrollTo(0, savedScrollY);
    }
  }, [loading, allPeople.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const { results, totalPages } = await fetchPage(nextPage);
      setAllPeople((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...results.filter((p) => !existingIds.has(p.id))];
      });
      setCurrentPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, fetchPage]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  const handlePersonClick = (person: TMDBPersonSummary) => {
    navigate(`/person/${person.id}`, {
      state: {
        from: "/people",
        isReturn: true,
        scrollY: window.scrollY,
        loadedPages: currentPage,
      },
    });
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Typography.Title level={3} style={{ marginBottom: 20 }}>
        {searchTerm ? `People results for "${searchTerm}"` : "Popular People"}
      </Typography.Title>

      {loading ? (
        <Row gutter={[16, 20]}>
          <SkeletonCard count={12} />
        </Row>
      ) : (
        <>
          <Row gutter={[16, 20]}>
            {allPeople.map((person) => (
              <Col key={person.id} xs={12} sm={8} md={6} lg={4}>
                <motion.div
                  whileHover={{ scale: 1.04, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Card
                    hoverable
                    className="glass-card"
                    onClick={() => handlePersonClick(person)}
                    cover={
                      <img
                        src={
                          person.profile_path
                            ? `${IMG_URL}${person.profile_path}`
                            : "https://placehold.co/200x300?text=No+Image"
                        }
                        alt={person.name}
                        loading="lazy"
                        className="movie-poster-img"
                      />
                    }
                    styles={{ body: { padding: "8px 10px" } }}
                    aria-label={`View profile of ${person.name}`}
                  >
                    <MarqueeTitle style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{person.name}</MarqueeTitle>
                    {person.known_for_department && (
                      <Tag icon={<UserOutlined />} color="default" style={{ fontSize: 11 }}>
                        {person.known_for_department}
                      </Tag>
                    )}
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>

          {loadingMore && (
            <Row gutter={[16, 20]} style={{ marginTop: 16 }}>
              <SkeletonCard count={6} />
            </Row>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}
    </motion.div>
  );
}

export default PeoplePage;
