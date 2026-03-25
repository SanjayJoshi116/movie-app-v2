import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Typography, Spin } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import Pagination from "../components/Pagination";
import { fetchPopularPeople, searchPeople } from "../api/tmdb";
import type { TMDBPersonSummary } from "../types";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function PeoplePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchTerm } = useAppContext();

  const locationState = location.state as { page?: number; isReturn?: boolean } | null;
  const restoredPage = locationState?.page ?? 1;
  const isReturning = locationState?.isReturn ?? false;
  const firstFetchPage = useRef(restoredPage);

  const [people, setPeople] = useState<TMDBPersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(restoredPage);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const res = searchTerm
          ? await searchPeople(searchTerm, page)
          : await fetchPopularPeople(page);
        setPeople(res.data.results);
        setCurrentPage(res.data.page);
        setTotalPages(Math.min(res.data.total_pages, 500));
      } catch {
        setPeople([]);
      } finally {
        setLoading(false);
      }
    },
    [searchTerm],
  );

  useEffect(() => {
    if (!isReturning) setCurrentPage(1);
    const page = firstFetchPage.current;
    firstFetchPage.current = 1;
    fetchData(page);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (page: number) => {
    window.scrollTo(0, 0);
    fetchData(page);
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
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[16, 20]}>
            {people.map((person) => (
              <Col key={person.id} xs={12} sm={8} md={6} lg={4}>
                <motion.div
                  whileHover={{ scale: 1.04, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Card
                    hoverable
                    className="glass-card"
                    onClick={() => navigate(`/person/${person.id}`, { state: { from: '/people', page: currentPage } })}
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
                    bodyStyle={{ padding: "8px 10px" }}
                    aria-label={`View profile of ${person.name}`}
                  >
                    <Typography.Text strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                      {person.name}
                    </Typography.Text>
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

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </motion.div>
  );
}

export default PeoplePage;
