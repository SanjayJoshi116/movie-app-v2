import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Tag, Typography, Skeleton } from "antd";
import { StarFilled } from "@ant-design/icons";
import { discoverMovies, discoverTV, fetchTrending } from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary } from "../types";
import { FONT_SIZE } from "../constants/typography";
import { BACKDROP_URL } from "../constants/ui";
import { isPlainClick } from "./CardLink";

interface Props {
  mediaType: "movie" | "tv";
  excludeGenreId?: number;
  /**
   * Feature the most popular title from discover with these params instead of
   * this week's trending (Anime: its keyword). Every result matches, so with
   * none there is no hero rather than an off-topic one.
   */
  discoverParams?: Record<string, string | number>;
  /** Runs just before navigating to the detail page (browse pages stash their restore state here). */
  onBeforeNavigate?: () => void;
}

const HeroBanner = ({ mediaType, excludeGenreId, discoverParams, onBeforeNavigate }: Props) => {
  const [item, setItem] = useState<TMDBMovieSummary | TMDBTVSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // /anime toggles mediaType on this same instance: a slower earlier response
    // must not show a movie as the TV hero (and link to /tv/<movieId>).
    let cancelled = false;
    setLoading(true);
    setItem(null);
    const request = discoverParams
      ? (mediaType === "movie" ? discoverMovies : discoverTV)({ sort_by: "popularity.desc", ...discoverParams })
      : fetchTrending(mediaType, "week");
    request
      .then((res) => {
        if (cancelled) return;
        const results = res.data.results;
        const picked = discoverParams
          // Every result matches; take the first one the hero can show.
          ? results.find((r) => r.backdrop_path)
          : excludeGenreId
            ? results.find((r) => !r.genre_ids.includes(excludeGenreId)) ?? results[0]
            : results[0];
        if (picked) setItem(picked);
      })
      .catch(() => {
        // silently fail — banner is optional
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // discoverParams is compared by value: callers pass an inline object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, excludeGenreId, JSON.stringify(discoverParams)]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <Skeleton.Image
          active
          style={{ width: "100%", height: 420, borderRadius: 16, marginBottom: 28, display: "block" }}
        />
      </motion.div>
    );
  }

  if (!item?.backdrop_path) return null;

  const title = "title" in item ? item.title : item.name;
  const detailPath = mediaType === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`;

  const overview =
    item.overview.length > 160
      ? item.overview.slice(0, 157) + "…"
      : item.overview;

  return (
    <motion.section
      className="hero-banner"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <img
        className="hero-backdrop"
        src={`${BACKDROP_URL}${item.backdrop_path}`}
        alt={title}
      />
      <div className="hero-gradient-overlay" />
      <div className="hero-content">
        <Typography.Title className="hero-title" level={1}>
          {title}
        </Typography.Title>
        <Typography.Paragraph className="hero-overview">
          {overview}
        </Typography.Paragraph>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Tag
            icon={<StarFilled />}
            color="gold"
            style={{ fontSize: FONT_SIZE.caption, padding: "2px 8px" }}
          >
            {item.vote_average.toFixed(1)}
          </Tag>
          <Button
            type="primary"
            size="large"
            // A real link (href), so modifier/middle clicks open a new tab; a
            // plain click stays in the SPA and stashes the browse state first.
            href={detailPath}
            onClick={(e) => {
              if (!isPlainClick(e)) return;
              e.preventDefault();
              onBeforeNavigate?.();
              navigate(detailPath);
            }}
          >
            View Details
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default HeroBanner;
