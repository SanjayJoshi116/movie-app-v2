import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import SkeletonCard from "../components/SkeletonCard";
import MarqueeTitle from "../components/MarqueeTitle";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { fetchPopularPeople, searchPeople } from "../api/tmdb";
import type { TMDBPersonSummary } from "../types";
import { pageVariants, IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";

function PeoplePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchTerm, includeAdult } = useAppContext();

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

  const { items: allPeople, currentPage, hasMore, loading, loadingMore, loadMore } = usePaginatedFetch<TMDBPersonSummary>({
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
                    <MarqueeTitle style={{ fontSize: FONT_SIZE.emphasis, fontWeight: 600, marginBottom: 4 }}>{person.name}</MarqueeTitle>
                    {person.known_for_department && (
                      <Tag icon={<UserOutlined />} color="default" style={{ fontSize: FONT_SIZE.caption }}>
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
