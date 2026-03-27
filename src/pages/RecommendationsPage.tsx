import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Button, Typography, Empty, Spin, Divider } from "antd";
import { StarFilled, BulbOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import {
  fetchSimilarMovies,
  fetchTVRecommendations,
  fetchMovieDetails,
  fetchTVDetails,
  discoverMovies,
  fetchMovieGenres,
  fetchTVGenres,
} from "../api/tmdb";
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

type RecSection = {
  key: string;
  label: string;
  items: RecItem[];
};

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function RecommendationsPage() {
  const navigate = useNavigate();
  const { watchedList, allRatings } = useAppContext();
  const [sections, setSections] = useState<RecSection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (watchedList.length === 0) return;

    const watchedIds = new Set(watchedList.map((w) => `${w.type}-${w.id}`));

    // Deduplicate helper
    const seen = new Set<string>();
    const filterNew = (items: RecItem[]): RecItem[] =>
      items.filter((item) => {
        const key = `${item.type}-${item.id}`;
        if (seen.has(key) || watchedIds.has(key)) return false;
        seen.add(key);
        return true;
      });

    setLoading(true);

    const run = async () => {
      // Sort watched: rated items first (higher rating first), then by recency
      const sorted = [...watchedList].sort((a, b) => {
        const ra = allRatings[`${a.type}-${a.id}`]?.userRating ?? 0;
        const rb = allRatings[`${b.type}-${b.id}`]?.userRating ?? 0;
        if (rb !== ra) return rb - ra;
        return b.watchedAt.localeCompare(a.watchedAt);
      });

      const top8 = sorted.slice(0, 8);
      const becauseSource = sorted.slice(0, 3);

      // --- Fetch genre name maps ---
      const [movieGenresRes, tvGenresRes] = await Promise.allSettled([
        fetchMovieGenres(),
        fetchTVGenres(),
      ]);
      const genreNameMap = new Map<number, string>();
      if (movieGenresRes.status === "fulfilled") {
        for (const g of movieGenresRes.value.data.genres) genreNameMap.set(g.id, g.name);
      }
      if (tvGenresRes.status === "fulfilled") {
        for (const g of tvGenresRes.value.data.genres) genreNameMap.set(g.id, g.name);
      }

      // --- Analyze top genres from watched items ---
      const genreCount = new Map<number, number>();
      const detailResults = await Promise.allSettled(
        top8.map((item) =>
          item.type === "movie"
            ? fetchMovieDetails(item.id).then((r) => r.data.genres?.map((g) => g.id) ?? [])
            : fetchTVDetails(item.id).then((r) => r.data.genres?.map((g) => g.id) ?? [])
        )
      );

      for (const result of detailResults) {
        if (result.status !== "fulfilled") continue;
        for (const gId of result.value) {
          genreCount.set(gId, (genreCount.get(gId) ?? 0) + 1);
        }
      }

      const topGenres = [...genreCount.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id]) => id);

      // --- Genre-based discovery sections ---
      const genreSectionResults = await Promise.allSettled(
        topGenres.map((genreId) =>
          discoverMovies({
            with_genres: genreId,
            sort_by: "vote_average.desc",
            "vote_count.gte": 100,
            page: 1,
          }).then((res) =>
            (res.data.results as TMDBMovieSummary[]).map((m): RecItem => ({
              id: m.id,
              type: "movie",
              title: m.title,
              posterPath: m.poster_path,
              voteAverage: m.vote_average,
            }))
          )
        )
      );

      const genreSections: RecSection[] = [];
      genreSectionResults.forEach((result, idx) => {
        if (result.status !== "fulfilled") return;
        const genreId = topGenres[idx] as number;
        const genreName = genreNameMap.get(genreId) ?? `Genre ${genreId}`;
        const items = filterNew(result.value).slice(0, 12);
        if (items.length > 0) {
          genreSections.push({
            key: `genre-${genreId}`,
            label: `Based on your taste in ${genreName}`,
            items,
          });
        }
      });

      // --- "Because you watched X" sections ---
      const becauseResults = await Promise.allSettled(
        becauseSource.map((item) =>
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
      );

      const becauseSections: RecSection[] = [];
      becauseResults.forEach((result, idx) => {
        if (result.status !== "fulfilled") return;
        const source = becauseSource[idx];
        if (!source) return;
        const items = filterNew(result.value).slice(0, 12);
        if (items.length > 0) {
          becauseSections.push({
            key: `because-${source.id}`,
            label: `Because you watched ${source.title}`,
            items,
          });
        }
      });

      setSections([...genreSections, ...becauseSections]);
    };

    run()
      .catch((err) => console.error("Error building recommendations:", err))
      .finally(() => setLoading(false));
  }, [watchedList, allRatings]);

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);

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
          image={<BulbOutlined style={{ fontSize: 48, color: "#f5c518" }} />}
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
      ) : totalItems === 0 ? (
        <Empty
          image={<BulbOutlined style={{ fontSize: 48, color: "#aaa" }} />}
          description="No recommendations found for your watched titles."
          style={{ padding: "60px 0" }}
        />
      ) : (
        sections.map((section) => (
          <div key={section.key}>
            <Divider orientation="left">
              <Typography.Text strong style={{ fontSize: 15 }}>{section.label}</Typography.Text>
            </Divider>
            <Row gutter={[16, 20]} style={{ marginBottom: 8 }}>
              {section.items.map((item) => (
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
                              onClick={() => navigate(`/${item.type === "movie" ? "movie" : "tv"}/${item.id}`, { state: { from: "/recommendations" } })}
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
          </div>
        ))
      )}
    </motion.div>
  );
}

export default RecommendationsPage;
