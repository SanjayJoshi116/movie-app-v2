import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Card, Tag, Button, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import type { MediaType } from "../types";
import type { MediaSummary } from "../utils/mediaSummary";
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

// The movie/TV poster card of the browse grids (Movies, TV, Anime) and Search's
// Movies/TV tabs. Not MediaGrid (library grid) or MediaCardGrid (detail pages).
// Props are flat so memo's shallow compare holds (callers keep onKnowMore stable);
// build them with toMediaSummary. Writes are explicit add/remove, never toggle:
// the toast must match what ran, and marking goes through MarkWatchedModal.
interface Props extends MediaSummary {
  // Gets the card's own type, so a plain click and the poster link's href
  // always agree on /movie or /tv.
  onKnowMore: (id: number, type: MediaType) => void;
}

const MediaCard = ({ id, type, title, posterPath, voteAverage, onKnowMore }: Props) => {
  const idleIconColor = useActionIconColor();
  const { isIn: isInWatchlist, add: addToWatchlist, remove: removeFromWatchlist } = useWatchlistContext();
  const { isWatched, add: addWatched, remove: removeWatched } = useWatchedContext();
  const { showSuccess, showError } = useToast();
  const [showMarkWatchedModal, setShowMarkWatchedModal] = useState(false);
  const watched = isWatched(id, type);
  const inWatchlist = isInWatchlist(id, type);
  const watchedLabel = watched ? "Unmark watched" : "Mark as watched";
  const watchlistLabel = inWatchlist ? "Remove from watchlist" : "Add to watchlist";
  const item = { id, type, title, posterPath, voteAverage };

  return (
    <>
    <motion.div
      role="article"
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ cursor: "pointer" }}
      onClick={() => onKnowMore(id, type)}
    >
      <Card
        hoverable
        className="glass-card"
        cover={
          // Poster-only link (the card has its own buttons); the card's mouse
          // onClick stays, so stop the click there.
          <CardLink to={`/${type}/${id}`} onNavigate={() => onKnowMore(id, type)} label={title} stopPropagation>
            {posterPath ? (
              <img
                src={`${POSTER_URL}${posterPath}`}
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
              <Tag color={ratingColor(voteAverage)} style={{ margin: 0 }}>
                ★ {voteAverage.toFixed(1)}
              </Tag>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip title={watchedLabel}>
                  <Button
                    size="small"
                    type="text"
                    icon={watched ? <EyeFilled /> : <EyeOutlined />}
                    style={{ color: watched ? WATCHED_GREEN : idleIconColor }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (watched) {
                        try {
                          await removeWatched(id, type);
                          showSuccess("Removed from watched");
                        } catch (err) {
                          showError(getApiError(err, "Failed to update watched status."));
                        }
                      } else {
                        setShowMarkWatchedModal(true);
                      }
                    }}
                    aria-label={`${watchedLabel}: ${title}`}
                  />
                </Tooltip>
                <Tooltip title={watchlistLabel}>
                  <Button
                    size="small"
                    type="text"
                    icon={inWatchlist ? <BookFilled /> : <BookOutlined />}
                    style={{ color: inWatchlist ? IN_WATCHLIST_BLUE : idleIconColor }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Explicit add/remove, not toggle: the toast names the action
                      // taken, even when the list changed since this render.
                      try {
                        if (inWatchlist) await removeFromWatchlist(id, type);
                        else await addToWatchlist(item);
                        showSuccess(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
                      } catch (err) {
                        showError(getApiError(err, "Failed to update watchlist."));
                      }
                    }}
                    aria-label={`${watchlistLabel}: ${title}`}
                  />
                </Tooltip>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={(e) => {
                    e.stopPropagation();
                    onKnowMore(id, type);
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
      mediaId={id}
      mediaType={type}
      onCancel={() => setShowMarkWatchedModal(false)}
      onConfirm={async (details) => {
        try {
          await addWatched({ ...item, ...details });
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

export default memo(MediaCard);
