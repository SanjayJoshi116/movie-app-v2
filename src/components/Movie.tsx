import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Card, Tag, Button, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import type { TMDBMovieSummary } from "../types";
import MarqueeTitle from "./MarqueeTitle";
import { useWatchlistContext } from "../context/WatchlistContext";
import { useWatchedContext } from "../context/WatchedContext";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";
import { MarkWatchedModal } from "./MarkWatchedModal";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { POSTER_URL, WATCHED_GREEN, IN_WATCHLIST_BLUE } from "../constants/ui";
import { useActionIconColor } from "../hooks/useActionIconColor";
import { ratingColor } from "../utils/colors";
import { FONT_SIZE } from "../constants/typography";
import CardLink from "./CardLink";

interface Props {
  movie: TMDBMovieSummary;
  onKnowMore: (id: number) => void;
}

const Movie = ({ movie, onKnowMore }: Props) => {
  const { title, poster_path, vote_average } = movie;
  const idleIconColor = useActionIconColor();
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
          // Poster-only link (the card has its own buttons); the card's mouse
          // onClick stays, so stop the click there.
          <CardLink to={`/movie/${movie.id}`} onNavigate={() => onKnowMore(movie.id)} label={title} stopPropagation>
            {poster_path ? (
              <img
                src={`${POSTER_URL}${poster_path}`}
                alt=""
                loading="lazy"
                className="movie-poster-img"
              />
            ) : (
              <PosterPlaceholder className="movie-poster-img" />
            )}
          </CardLink>
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
              <Tag color={ratingColor(vote_average)} style={{ margin: 0 }}>
                ★ {vote_average.toFixed(1)}
              </Tag>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip title={isWatched(movie.id, "movie") ? "Unmark watched" : "Mark as watched"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isWatched(movie.id, "movie") ? <EyeFilled /> : <EyeOutlined />}
                    style={{ color: isWatched(movie.id, "movie") ? WATCHED_GREEN : idleIconColor }}
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
                    style={{ color: isInWatchlist(movie.id, "movie") ? IN_WATCHLIST_BLUE : idleIconColor }}
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
