import { memo, useState } from "react";
import { Card, Tag, Button, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import { motion } from "framer-motion";
import type { TMDBTVSummary } from "../types";
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
  tvShow: TMDBTVSummary;
  onKnowMore: (id: number) => void;
}

const TVShowCard = ({ tvShow, onKnowMore }: Props) => {
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
      onClick={() => onKnowMore(tvShow.id)}
    >
      <Card
        hoverable
        className="glass-card"
        cover={
          // Poster-only link (the card has its own buttons); the card's mouse
          // onClick stays, so stop the click there.
          <CardLink to={`/tv/${tvShow.id}`} onNavigate={() => onKnowMore(tvShow.id)} label={tvShow.name} stopPropagation>
            {tvShow.poster_path ? (
              <img
                src={`${POSTER_URL}${tvShow.poster_path}`}
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
            <MarqueeTitle style={{ fontSize: FONT_SIZE.emphasis, lineHeight: "1.3" }}>{tvShow.name}</MarqueeTitle>
          }
          description={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Tag color={ratingColor(tvShow.vote_average)} style={{ margin: 0 }}>
                ★ {tvShow.vote_average.toFixed(1)}
              </Tag>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip title={isWatched(tvShow.id, "tv") ? "Unmark watched" : "Mark as watched"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isWatched(tvShow.id, "tv") ? <EyeFilled /> : <EyeOutlined />}
                    style={{ color: isWatched(tvShow.id, "tv") ? WATCHED_GREEN : idleIconColor }}
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
                    aria-label={`${isWatched(tvShow.id, "tv") ? "Unmark watched" : "Mark as watched"}: ${tvShow.name}`}
                  />
                </Tooltip>
                <Tooltip title={isInWatchlist(tvShow.id, "tv") ? "Remove from watchlist" : "Add to watchlist"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isInWatchlist(tvShow.id, "tv") ? <BookFilled /> : <BookOutlined />}
                    style={{ color: isInWatchlist(tvShow.id, "tv") ? IN_WATCHLIST_BLUE : idleIconColor }}
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
                    aria-label={`${isInWatchlist(tvShow.id, "tv") ? "Remove from watchlist" : "Add to watchlist"}: ${tvShow.name}`}
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
          throw err; // the dialog stays open with what was typed
        }
        setShowMarkWatchedModal(false);
      }}
    />
    </>
  );
};

export default memo(TVShowCard);
