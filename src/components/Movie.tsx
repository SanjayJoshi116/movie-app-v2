import React from "react";
import { motion } from "framer-motion";
import { Card, Tag, Button, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import type { TMDBMovieSummary } from "../types";
import MarqueeTitle from "./MarqueeTitle";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

function getRatingColor(vote: number): string {
  if (vote >= 8) return "#52c41a";
  if (vote >= 5) return "#faad14";
  return "#ff4d4f";
}

interface Props {
  movie: TMDBMovieSummary;
  onKnowMore: (id: number) => void;
}

const Movie = ({ movie, onKnowMore }: Props) => {
  const { title, poster_path, vote_average } = movie;
  const { isWatched, toggleWatched, isInWatchlist, toggleWatchlist, theme } = useAppContext();
  const { showSuccess } = useToast();

  return (
    <motion.div
      role="article"
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ cursor: "pointer" }}
      onClick={() => onKnowMore(movie.id)}
    >
      <Card
        hoverable
        className="glass-card"
        cover={
          <img
            src={poster_path ? `${IMG_URL}${poster_path}` : "https://placehold.co/500x750?text=No+Image"}
            alt={title}
            loading="lazy"
            className="movie-poster-img"
          />
        }
        styles={{ body: { padding: "10px 12px" } }}
        style={{ height: "100%" }}
      >
        <Card.Meta
          title={
            <MarqueeTitle style={{ fontSize: 14, lineHeight: "1.3" }}>{title}</MarqueeTitle>
          }
          description={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Tag color={getRatingColor(vote_average)} style={{ margin: 0 }}>
                ★ {vote_average.toFixed(1)}
              </Tag>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip title={isWatched(movie.id, "movie") ? "Unmark watched" : "Mark as watched"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isWatched(movie.id, "movie") ? <EyeFilled /> : <EyeOutlined />}
                    style={{ color: isWatched(movie.id, "movie") ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const alreadyWatched = isWatched(movie.id, "movie");
                      toggleWatched({ id: movie.id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                      showSuccess(alreadyWatched ? "Removed from watched" : "Marked as watched");
                    }}
                    aria-label={isWatched(movie.id, "movie") ? "Unmark watched" : "Mark as watched"}
                  />
                </Tooltip>
                <Tooltip title={isInWatchlist(movie.id, "movie") ? "Remove from watchlist" : "Add to watchlist"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isInWatchlist(movie.id, "movie") ? <BookFilled /> : <BookOutlined />}
                    style={{ color: isInWatchlist(movie.id, "movie") ? "#1677ff" : theme === "dark" ? "#f5c518" : "#000000" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const inList = isInWatchlist(movie.id, "movie");
                      toggleWatchlist({ id: movie.id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                      showSuccess(inList ? "Removed from watchlist" : "Added to watchlist");
                    }}
                    aria-label={isInWatchlist(movie.id, "movie") ? "Remove from watchlist" : "Add to watchlist"}
                  />
                </Tooltip>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={(e) => {
                    e.stopPropagation();
                    onKnowMore(movie.id);
                  }}
                  aria-label={`Know more about ${title}`}
                >
                  Details
                </Button>
              </div>
            </div>
          }
        />
      </Card>
    </motion.div>
  );
};

export default Movie;
