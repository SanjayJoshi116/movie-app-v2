import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Button, Typography, Empty, Spin, Divider } from "antd";
import { StarFilled, BulbOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { fetchPersonalizedRecommendations, type PersonalizedRecSection } from "../api/userApi";
import {
  fetchSimilarMovies,
  fetchTVRecommendations,
  fetchMovieDetails,
  fetchTVDetails,
  discoverMovies,
  discoverTV,
  fetchTrending,
  fetchPersonCombinedCredits,
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

// Interleave two arrays (movie, tv, movie, tv...)
function interleave(a: RecItem[], b: RecItem[]): RecItem[] {
  const result: RecItem[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (i < a.length) result.push(a[i]!);
    if (i < b.length) result.push(b[i]!);
  }
  return result;
}

function RecommendationsPage() {
  const navigate = useNavigate();
  const { watchedList, allRatings } = useAppContext();
  const [sections, setSections] = useState<RecSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [personalizedSections, setPersonalizedSections] = useState<PersonalizedRecSection[]>([]);
  const [personalizedLoading, setPersonalizedLoading] = useState(false);

  useEffect(() => {
    if (watchedList.length === 0) return;

    const watchedIds = new Set(watchedList.map((w) => `${w.type}-${w.id}`));

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
      // Sort watched: highest-rated first, then most recent
      const sorted = [...watchedList].sort((a, b) => {
        const ra = allRatings[`${a.type}-${a.id}`]?.userRating ?? 0;
        const rb = allRatings[`${b.type}-${b.id}`]?.userRating ?? 0;
        if (rb !== ra) return rb - ra;
        return b.watchedAt.localeCompare(a.watchedAt);
      });

      // Cast analysis: random sample of 20 from full watched list
      const shuffled = [...watchedList].sort(() => Math.random() - 0.5);
      const castSample = shuffled.slice(0, 20);

      // "Because you watched X": 5 seeds — mix of top-rated and most-recent
      const byRating = sorted.slice(0, 3);
      const byRecency = [...watchedList]
        .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
        .filter((item) => !byRating.some((r) => r.id === item.id && r.type === item.type))
        .slice(0, 2);
      const becauseSource = [...byRating, ...byRecency];

      // --- Genre name maps ---
      const [movieGenresRes, tvGenresRes] = await Promise.allSettled([
        fetchMovieGenres(),
        fetchTVGenres(),
      ]);
      const genreNameMap = new Map<number, string>();
      if (movieGenresRes.status === "fulfilled")
        for (const g of movieGenresRes.value.data.genres) genreNameMap.set(g.id, g.name);
      if (tvGenresRes.status === "fulfilled")
        for (const g of tvGenresRes.value.data.genres) genreNameMap.set(g.id, g.name);

      // --- Fetch details for all watched items (genres) + cast sample (cast) ---
      type DetailInfo = { genres: number[]; cast: { id: number; name: string }[] };
      const detailResults = await Promise.allSettled(
        sorted.map((item): Promise<DetailInfo> =>
          item.type === "movie"
            ? fetchMovieDetails(item.id).then((r) => ({
                genres: r.data.genres?.map((g: { id: number }) => g.id) ?? [],
                cast: r.data.credits?.cast?.slice(0, 3).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })) ?? [],
              }))
            : fetchTVDetails(item.id).then((r) => ({
                genres: r.data.genres?.map((g: { id: number }) => g.id) ?? [],
                cast: [],
              }))
        )
      );

      // Build genre frequency map
      const genreCount = new Map<number, number>();
      // Build genre frequency map for highly-rated items (user rating >= 7)
      const lovedGenreCount = new Map<number, number>();
      // Collect cast frequency
      const castCount = new Map<number, { name: string; count: number }>();

      // Build cast frequency map from the random sample only
      const castSampleIds = new Set(castSample.map((w) => `${w.type}-${w.id}`));

      detailResults.forEach((result, idx) => {
        if (result.status !== "fulfilled") return;
        const { genres, cast } = result.value;
        const item = sorted[idx]!;
        const userRating = allRatings[`${item.type}-${item.id}`]?.userRating ?? 0;

        // Genre analysis: use all watched items
        for (const gId of genres) {
          genreCount.set(gId, (genreCount.get(gId) ?? 0) + 1);
          if (userRating >= 7)
            lovedGenreCount.set(gId, (lovedGenreCount.get(gId) ?? 0) + 1);
        }

        // Cast analysis: only for the random sample
        if (castSampleIds.has(`${item.type}-${item.id}`)) {
          for (const c of cast) {
            const existing = castCount.get(c.id);
            castCount.set(c.id, { name: c.name, count: (existing?.count ?? 0) + 1 });
          }
        }
      });

      const topGenres = [...genreCount.entries()].sort(([, a], [, b]) => b - a).slice(0, 3).map(([id]) => id);
      const topLovedGenres = [...lovedGenreCount.entries()].sort(([, a], [, b]) => b - a).slice(0, 2).map(([id]) => id);
      const topActors = [...castCount.entries()].sort(([, a], [, b]) => b.count - a.count).slice(0, 3);

      // ── 1. "More like what you love" ─────────────────────────────────────────
      let lovedSection: RecSection | null = null;
      if (topLovedGenres.length > 0) {
        const lovedResults = await Promise.allSettled(
          topLovedGenres.map((gId) =>
            Promise.all([
              discoverMovies({ with_genres: gId, sort_by: "vote_average.desc", "vote_count.gte": 100, page: 1 })
                .then((r) => (r.data.results as TMDBMovieSummary[]).map((m): RecItem => ({ id: m.id, type: "movie", title: m.title, posterPath: m.poster_path, voteAverage: m.vote_average }))),
              discoverTV({ with_genres: gId, sort_by: "vote_average.desc", "vote_count.gte": 50, page: 1 })
                .then((r) => (r.data.results as TMDBTVSummary[]).map((t): RecItem => ({ id: t.id, type: "tv", title: t.name, posterPath: t.poster_path, voteAverage: t.vote_average }))),
            ]).then(([mov, tv]) => interleave(mov, tv))
          )
        );
        const lovedItems = filterNew(
          lovedResults.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        ).slice(0, 12);
        if (lovedItems.length > 0)
          lovedSection = { key: "loved", label: "More like what you love", items: lovedItems };
      }

      // ── 2. Trending This Week ────────────────────────────────────────────────
      let trendingSection: RecSection | null = null;
      const trendingRes = await fetchTrending("all", "week").catch(() => null);
      if (trendingRes) {
        const trendingItems = filterNew(
          (trendingRes.data.results as Array<TMDBMovieSummary & TMDBTVSummary & { media_type: string }>)
            .filter((r) => r.media_type === "movie" || r.media_type === "tv")
            .map((r): RecItem => ({
              id: r.id,
              type: r.media_type as "movie" | "tv",
              title: r.media_type === "movie" ? r.title : r.name,
              posterPath: r.poster_path,
              voteAverage: r.vote_average,
            }))
        ).slice(0, 12);
        if (trendingItems.length > 0)
          trendingSection = { key: "trending", label: "Trending This Week", items: trendingItems };
      }

      // ── 3. Genre sections (mixed movies + TV) ───────────────────────────────
      const genreSectionResults = await Promise.allSettled(
        topGenres.map((genreId) =>
          Promise.all([
            discoverMovies({ with_genres: genreId, sort_by: "vote_average.desc", "vote_count.gte": 100, page: 1 })
              .then((r) => (r.data.results as TMDBMovieSummary[]).map((m): RecItem => ({ id: m.id, type: "movie", title: m.title, posterPath: m.poster_path, voteAverage: m.vote_average }))),
            discoverTV({ with_genres: genreId, sort_by: "vote_average.desc", "vote_count.gte": 50, page: 1 })
              .then((r) => (r.data.results as TMDBTVSummary[]).map((t): RecItem => ({ id: t.id, type: "tv", title: t.name, posterPath: t.poster_path, voteAverage: t.vote_average }))),
          ]).then(([mov, tv]) => interleave(mov, tv))
        )
      );

      const genreSections: RecSection[] = [];
      genreSectionResults.forEach((result, idx) => {
        if (result.status !== "fulfilled") return;
        const genreId = topGenres[idx] as number;
        const genreName = genreNameMap.get(genreId) ?? `Genre ${genreId}`;
        const items = filterNew(result.value).slice(0, 12);
        if (items.length > 0)
          genreSections.push({ key: `genre-${genreId}`, label: `Based on your taste in ${genreName}`, items });
      });

      // ── 4. "Because you watched X" ───────────────────────────────────────────
      const becauseResults = await Promise.allSettled(
        becauseSource.map((item) =>
          item.type === "movie"
            ? fetchSimilarMovies(item.id).then((res) =>
                res.data.results.map((m: TMDBMovieSummary): RecItem => ({ id: m.id, type: "movie", title: m.title, posterPath: m.poster_path, voteAverage: m.vote_average }))
              )
            : fetchTVRecommendations(item.id).then((res) =>
                res.data.results.map((t: TMDBTVSummary): RecItem => ({ id: t.id, type: "tv", title: t.name, posterPath: t.poster_path, voteAverage: t.vote_average }))
              )
        )
      );

      const becauseSections: RecSection[] = [];
      becauseResults.forEach((result, idx) => {
        if (result.status !== "fulfilled") return;
        const source = becauseSource[idx];
        if (!source) return;
        const items = filterNew(result.value).slice(0, 12);
        if (items.length > 0)
          becauseSections.push({ key: `because-${source.id}`, label: `Because you watched ${source.title}`, items });
      });

      // ── 5. Hidden Gems ───────────────────────────────────────────────────────
      let hiddenGemsSection: RecSection | null = null;
      const [gemsMovRes, gemsTVRes] = await Promise.allSettled([
        discoverMovies({ sort_by: "vote_average.desc", "vote_average.gte": 7.5, "vote_count.gte": 50, "vote_count.lte": 1500, page: 1 })
          .then((r) => (r.data.results as TMDBMovieSummary[]).map((m): RecItem => ({ id: m.id, type: "movie", title: m.title, posterPath: m.poster_path, voteAverage: m.vote_average }))),
        discoverTV({ sort_by: "vote_average.desc", "vote_average.gte": 7.5, "vote_count.gte": 50, "vote_count.lte": 1500, page: 1 })
          .then((r) => (r.data.results as TMDBTVSummary[]).map((t): RecItem => ({ id: t.id, type: "tv", title: t.name, posterPath: t.poster_path, voteAverage: t.vote_average }))),
      ]);
      const gemsItems = filterNew(
        interleave(
          gemsMovRes.status === "fulfilled" ? gemsMovRes.value : [],
          gemsTVRes.status === "fulfilled" ? gemsTVRes.value : [],
        )
      ).slice(0, 12);
      if (gemsItems.length > 0)
        hiddenGemsSection = { key: "hidden-gems", label: "Hidden Gems", items: gemsItems };

      // ── 6. "Because you like [Actor]" ────────────────────────────────────────
      const actorSectionResults = await Promise.allSettled(
        topActors.map(([actorId, { name }]) =>
          fetchPersonCombinedCredits(actorId).then((res) => {
            const credits = (res.data.cast ?? []) as Array<{ id: number; media_type: string; title?: string; name?: string; poster_path?: string | null; vote_average?: number }>;
            const items: RecItem[] = credits
              .filter((c) => (c.media_type === "movie" || c.media_type === "tv") && (c.vote_average ?? 0) >= 6)
              .map((c): RecItem => ({
                id: c.id,
                type: c.media_type as "movie" | "tv",
                title: c.media_type === "movie" ? (c.title ?? "") : (c.name ?? ""),
                posterPath: c.poster_path ?? null,
                voteAverage: c.vote_average ?? 0,
              }))
              .sort((a, b) => b.voteAverage - a.voteAverage);
            return { name, items };
          })
        )
      );

      const actorSections: RecSection[] = [];
      actorSectionResults.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const { name, items } = result.value;
        const filtered = filterNew(items).slice(0, 12);
        if (filtered.length > 0)
          actorSections.push({ key: `actor-${name}`, label: `Because you like ${name}`, items: filtered });
      });

      // ── Assemble final order ─────────────────────────────────────────────────
      setSections([
        ...(lovedSection ? [lovedSection] : []),
        ...(trendingSection ? [trendingSection] : []),
        ...genreSections,
        ...becauseSections,
        ...(hiddenGemsSection ? [hiddenGemsSection] : []),
        ...actorSections,
      ]);
    };

    run()
      .catch((err) => console.error("Error building recommendations:", err))
      .finally(() => setLoading(false));
  }, [watchedList, allRatings]);

  useEffect(() => {
    if (watchedList.length === 0) return;
    setPersonalizedLoading(true);
    fetchPersonalizedRecommendations()
      .then((res) => setPersonalizedSections(res.data))
      .catch((err) => {
        console.error("Personalized recommendations error:", err?.response?.data ?? err);
        setPersonalizedSections([]);
      })
      .finally(() => setPersonalizedLoading(false));
  }, [watchedList]);

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0) + personalizedSections.reduce((acc, s) => acc + s.items.length, 0);

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
        <>
          {personalizedLoading && (
            <Spin size="small" style={{ display: "block", marginBottom: 16 }} />
          )}
          {personalizedSections.map((section) => (
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
                        onClick={() => navigate(`/${item.type === "movie" ? "movie" : "tv"}/${item.id}`, { state: { from: "/recommendations" } })}
                        cover={
                          <img
                            src={item.posterPath ? `${IMG_URL}${item.posterPath}` : "https://placehold.co/500x750?text=No+Image"}
                            alt={item.title}
                            loading="lazy"
                            className="movie-poster-img"
                          />
                        }
                        styles={{ body: { padding: "10px 12px" } }}
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
                                onClick={(e) => { e.stopPropagation(); navigate(`/${item.type === "movie" ? "movie" : "tv"}/${item.id}`, { state: { from: "/recommendations" } }); }}
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
          ))}
          {sections.map((section) => (
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
                      onClick={() => navigate(`/${item.type === "movie" ? "movie" : "tv"}/${item.id}`, { state: { from: "/recommendations" } })}
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
                              onClick={(e) => { e.stopPropagation(); navigate(`/${item.type === "movie" ? "movie" : "tv"}/${item.id}`, { state: { from: "/recommendations" } }); }}
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
          ))}
        </>
      )}
    </motion.div>
  );
}

export default RecommendationsPage;
