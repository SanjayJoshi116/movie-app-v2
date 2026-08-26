import { memo, useState } from "react";
import { Card, Tag, Button, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import { motion } from "framer-motion";
import type { TMDBTVSummary } from "../types";
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
  tvShow: TMDBTVSummary;
  onKnowMore: (id: number) => void;
}

const TVShowCard = ({ tvShow, onKnowMore }: Props) => {
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
      onClick={() => onKnowMore(tvShow.id)}
    >
      <Card
        hoverable
        className="glass-card"
        cover={
          tvShow.poster_path ? (
            <img
              src={`${IMG_URL}${tvShow.poster_path}`}
              alt={tvShow.name}
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
            <MarqueeTitle style={{ fontSize: FONT_SIZE.emphasis, lineHeight: "1.3" }}>{tvShow.name}</MarqueeTitle>
          }
          description={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Tag color={getRatingColor(tvShow.vote_average)} style={{ margin: 0 }}>
                ★ {tvShow.vote_average.toFixed(1)}
              </Tag>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip title={isWatched(tvShow.id, "tv") ? "Unmark watched" : "Mark as watched"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isWatched(tvShow.id, "tv") ? <EyeFilled /> : <EyeOutlined />}
                    style={{ color: isWatched(tvShow.id, "tv") ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000" }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (isWatched(tvShow.id, "tv")) {
                        try {
                          await toggleWatched({ id: tvShow.id, type: "tv", title: tvShow.name, posterPath: tvShow.poster_path, voteAverage: tvShow.vote_average });
                          showSuccess("Removed from watched");
                        } catch (err) {
                          showError(getApiError(err, "Failed to update watched status."));
                        }
                      } else {
                        setShowMarkWatchedModal(true);
                      }
                    }}
                    aria-label={isWatched(tvShow.id, "tv") ? "Unmark watched" : "Mark as watched"}
                  />
                </Tooltip>
                <Tooltip title={isInWatchlist(tvShow.id, "tv") ? "Remove from watchlist" : "Add to watchlist"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isInWatchlist(tvShow.id, "tv") ? <BookFilled /> : <BookOutlined />}
                    style={{ color: isInWatchlist(tvShow.id, "tv") ? "#1677ff" : theme === "dark" ? "#f5c518" : "#000000" }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const inList = isInWatchlist(tvShow.id, "tv");
                      try {
                        await toggleWatchlist({ id: tvShow.id, type: "tv", title: tvShow.name, posterPath: tvShow.poster_path, voteAverage: tvShow.vote_average });
                        showSuccess(inList ? "Removed from watchlist" : "Added to watchlist");
                      } catch (err) {
                        showError(getApiError(err, "Failed to update watchlist."));
                      }
                    }}
                    aria-label={isInWatchlist(tvShow.id, "tv") ? "Remove from watchlist" : "Add to watchlist"}
                  />
                </Tooltip>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={(e) => {
                    e.stopPropagation();
                    onKnowMore(tvShow.id);
                  }}
                  aria-label={`Know more about ${tvShow.name}`}
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
      mediaId={tvShow.id}
      mediaType="tv"
      onCancel={() => setShowMarkWatchedModal(false)}
      onConfirm={async (details) => {
        try {
          await toggleWatched({ id: tvShow.id, type: "tv", title: tvShow.name, posterPath: tvShow.poster_path, voteAverage: tvShow.vote_average, ...details });
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

export default memo(TVShowCard);
