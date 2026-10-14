import { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Typography, Input, Empty } from "antd";
import { useAppContext } from "../context/useAppContext";
import SkeletonCard from "../components/SkeletonCard";
import { LoadMoreError } from "../components/LoadMoreError";
import { LoadError } from "../components/LoadError";
import PersonCard from "../components/PersonCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { fetchPopularPeople, searchPeople } from "../api/tmdb";
import type { TMDBPersonSummary } from "../types";
import { pageVariants } from "../constants/ui";
import { pageableTotal } from "../utils/tmdbPages";
import { stashReturnState } from "../utils/browseReturnState";

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
        totalPages: pageableTotal(res.data.total_pages),
      };
    },
    [searchTerm, includeAdult]
  );

  const { items: allPeople, currentPage, hasMore, loading, loadingMore, loadMore, error, retry, loadMoreError, retryLoadMore } = usePaginatedFetch<TMDBPersonSummary>({
    fetchPage,
    restore: { isReturning, savedLoadedPages, savedScrollY },
  });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore && !loadMoreError);

  const handlePersonClick = (person: TMDBPersonSummary) => {
    // Lets browser Back (not just the in-app Back button) restore this page.
    stashReturnState({ scrollY: window.scrollY, loadedPages: currentPage, isReturn: true });
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
        <SkeletonCard count={12} />
      ) : error ? (
        <LoadError onRetry={retry} />
      ) : allPeople.length === 0 ? (
        <Empty
          description={searchTerm ? `No people match "${searchTerm}".` : "No people to show."}
          style={{ padding: "60px 0" }}
        />
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
            <div style={{ marginTop: 16 }}>
              <SkeletonCard count={6} />
            </div>
          )}
          {loadMoreError != null && !loadingMore && <LoadMoreError error={loadMoreError} onRetry={retryLoadMore} />}

          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}
    </motion.div>
  );
}

export default PeoplePage;
