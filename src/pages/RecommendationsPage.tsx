import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Button, Typography, Empty, Spin } from "antd";
import { StarFilled } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { fetchSimilarMovies, fetchTVRecommendations } from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary } from "../types";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

function getRatingColor(vote: number): string {
  if (vote >= 8) return "#52c41a";
  if (vote >= 5) return "#faad14";
  return "#ff4d4f";
}

type RecItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  posterPath: string | null;
  voteAverage: number;
};

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function RecommendationsPage() {
  const navigate = useNavigate();
  const { watchedList } = useAppContext();
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (watchedList.length === 0) return;

    const source = [...watchedList]
      .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
      .slice(0, 8);

    const watchedIds = new Set(watchedList.map((w) => `${w.type}-${w.id}`));

    setLoading(true);

    Promise.allSettled(
      source.map((item) =>
        item.type === "movie"
          ? fetchSimilarMovies(item.id).then((res) =>
              res.data.results.map((m: TMDBMovieSummary): RecItem => ({
                id: m.id,
                type: "movie",
                title: m.title,
                posterPath: m.poster_path,
                voteAverage: m.vote_average,
              }))
            )
          : fetchTVRecommendations(item.id).then((res) =>
              res.data.results.map((t: TMDBTVSummary): RecItem => ({
                id: t.id,
                type: "tv",
                title: t.name,
                posterPath: t.poster_path,
                voteAverage: t.vote_average,
              }))
            )
      )
    ).then((results) => {
      const seen = new Set<string>();
      const combined: RecItem[] = [];

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const item of result.value) {
          const key = `${item.type}-${item.id}`;
          if (!seen.has(key) && !watchedIds.has(key)) {
            seen.add(key);
            combined.push(item);
          }
        }
      }

      setRecs(combined);
      setLoading(false);
    });
  }, [watchedList]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Typography.Title level={2} style={{ marginBottom: 8 }}>
        For You
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Recommendations based on {watchedList.length} watched title{watchedList.length !== 1 ? "s" : ""}
      </Typography.Text>

      {watchedList.length === 0 ? (
        <Empty
          description={
            <span>
              No watched titles yet.{" "}
              <Button type="link" onClick={() => navigate("/movies")} style={{ padding: 0 }}>
                Browse movies
              </Button>{" "}
              or{" "}
              <Button type="link" onClick={() => navigate("/tv")} style={{ padding: 0 }}>
                TV shows
              </Button>{" "}
              and mark them as watched.
            </span>
          }
          style={{ padding: "60px 0" }}
        />
      ) : loading ? (
        <Spin size="large" style={{ display: "block", margin: "80px auto" }} />
      ) : recs.length === 0 ? (
        <Empty description="No recommendations found for your watched titles." style={{ padding: "60px 0" }} />
      ) : (
        <Row gutter={[16, 20]}>
          {recs.map((item) => (
            <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4} xl={4}>
              <motion.div
                whileHover={{ scale: 1.04, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Card
                  hoverable
                  className="glass-card"
                  cover={
                    <img
                      src={item.posterPath ? `${IMG_URL}${item.posterPath}` : "https://placehold.co/500x750?text=No+Image"}
                      alt={item.title}
                      loading="lazy"
                      className="movie-poster-img"
                    />
                  }
                  bodyStyle={{ padding: "10px 12px" }}
                  style={{ height: "100%" }}
                >
                  <Card.Meta
                    title={
                      <span style={{ fontSize: 13, lineHeight: "1.3", display: "block" }}>
                        {item.title}
                      </span>
                    }
                    description={
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <Tag color={getRatingColor(item.voteAverage)} style={{ margin: 0 }}>
                          <StarFilled style={{ marginRight: 2 }} />
                          {item.voteAverage.toFixed(1)}
                        </Tag>
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          onClick={() => navigate(`/${item.type === "movie" ? "movie" : "tv"}/${item.id}`, { state: { from: '/recommendations' } })}
                          aria-label={`Details for ${item.title}`}
                        >
                          Details
                        </Button>
                      </div>
                    }
                  />
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      )}
    </motion.div>
  );
}

export default RecommendationsPage;
