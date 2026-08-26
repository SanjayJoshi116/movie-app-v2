import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Card, Tag, Button, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import type { TMDBMovieSummary } from "../types";
import MarqueeTitle from "./MarqueeTitle";
import { useUIContext } from "../context/UIContext";
import { useWatchlistContext } from "../context/WatchlistContext";
import { useWatchedContext } from "../context/WatchedContext";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";
import { MarkWatchedModal } from "./MarkWatchedModal";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";

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
  const { theme } = useUIContext();
  const { isIn: isInWatchlist, toggle: toggleWatchlist } = useWatchlistContext();
  const { isWatched, toggle: toggleWatched } = useWatchedContext();
  const { showSuccess, showError } = useToast();
  const [showMarkWatchedModal, setShowMarkWatchedModal] = useState(false);

  return (
    <>
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
          poster_path ? (
            <img
              src={`${IMG_URL}${poster_path}`}
              alt={title}
              loading="lazy"
              className="movie-poster-img"
            />
          ) : (
            <PosterPlaceholder className="movie-poster-img" />
          )
        }
        styles={{ body: { padding: "10px 12px" } }}
        style={{ height: "100%" }}
      >
        <Card.Meta
          title={
            <MarqueeTitle style={{ fontSize: FONT_SIZE.emphasis, lineHeight: "1.3" }}>{title}</MarqueeTitle>
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
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (isWatched(movie.id, "movie")) {
                        try {
                          await toggleWatched({ id: movie.id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                          showSuccess("Removed from watched");
                        } catch (err) {
                          showError(getApiError(err, "Failed to update watched status."));
                        }
                      } else {
                        setShowMarkWatchedModal(true);
                      }
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
                    onClick={async (e) => {
                      e.stopPropagation();
                      const inList = isInWatchlist(movie.id, "movie");
                      try {
                        await toggleWatchlist({ id: movie.id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                        showSuccess(inList ? "Removed from watchlist" : "Added to watchlist");
                      } catch (err) {
                        showError(getApiError(err, "Failed to update watchlist."));
                      }
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

    <MarkWatchedModal
      open={showMarkWatchedModal}
      mediaId={movie.id}
      mediaType="movie"
      onCancel={() => setShowMarkWatchedModal(false)}
      onConfirm={async (details) => {
        try {
          await toggleWatched({ id: movie.id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average, ...details });
          showSuccess("Marked as watched");
        } catch (err) {
          showError(getApiError(err, "Failed to mark as watched."));
        }
        setShowMarkWatchedModal(false);
      }}
    />
    </>
  );
};

export default memo(Movie);
