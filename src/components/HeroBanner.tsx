import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Tag, Typography, Skeleton } from "antd";
import { StarFilled } from "@ant-design/icons";
import { fetchTrending } from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary } from "../types";
import { FONT_SIZE } from "../constants/typography";

const BACKDROP_URL = "https://image.tmdb.org/t/p/original";

interface Props {
  mediaType: "movie" | "tv";
  excludeGenreId?: number;
  requireGenreId?: number;
}

const HeroBanner = ({ mediaType, excludeGenreId, requireGenreId }: Props) => {
  const [item, setItem] = useState<TMDBMovieSummary | TMDBTVSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setItem(null);
    fetchTrending(mediaType, "week")
      .then((res) => {
        const results = res.data.results;
        let picked = results[0];
        if (excludeGenreId) {
          picked = results.find((r) => !r.genre_ids.includes(excludeGenreId)) ?? results[0];
        } else if (requireGenreId) {
          picked = results.find((r) => r.genre_ids.includes(requireGenreId)) ?? results[0];
        }
        if (picked) setItem(picked);
      })
      .catch(() => {
        // silently fail — banner is optional
      })
      .finally(() => setLoading(false));
  }, [mediaType, excludeGenreId, requireGenreId]);

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
        loading="lazy"
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
            onClick={() => navigate(detailPath)}
          >
            View Details
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default HeroBanner;
