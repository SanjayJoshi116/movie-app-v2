import { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Typography, Input } from "antd";
import { useAppContext } from "../context/useAppContext";
import SkeletonCard from "../components/SkeletonCard";
import { LoadError } from "../components/LoadError";
import PersonCard from "../components/PersonCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { fetchPopularPeople, searchPeople } from "../api/tmdb";
import type { TMDBPersonSummary } from "../types";
import { pageVariants } from "../constants/ui";

function PeoplePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchTerm, setSearchTerm, includeAdult } = useAppContext();
  const [inputValue, setInputValue] = useState(searchTerm);

  const locationState = location.state as { scrollY?: number; loadedPages?: number; isReturn?: boolean } | null;
  const isReturning = locationState?.isReturn ?? false;
  const savedScrollY = locationState?.scrollY ?? 0;
  const savedLoadedPages = locationState?.loadedPages ?? 1;

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

  const { items: allPeople, currentPage, hasMore, loading, loadingMore, loadMore, error, retry } = usePaginatedFetch<TMDBPersonSummary>({
    fetchPage,
    restore: { isReturning, savedLoadedPages, savedScrollY },
  });

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

      <Input.Search
        id="people-search"
        name="search"
        autoComplete="off"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (e.target.value === "") setSearchTerm("");
        }}
        onSearch={(value) => setSearchTerm(value.trim())}
        placeholder="Search people…"
        allowClear
        size="large"
        aria-label="Search for people"
        style={{ marginBottom: 20, maxWidth: 480 }}
      />

      {loading ? (
        <Row gutter={[16, 20]}>
          <SkeletonCard count={12} />
        </Row>
      ) : error ? (
        <LoadError onRetry={retry} />
      ) : (
        <>
          <Row gutter={[16, 20]}>
            {allPeople.map((person) => (
              <Col key={person.id} xs={12} sm={8} md={6} lg={4}>
                <PersonCard person={person} onClick={() => handlePersonClick(person)} />
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
