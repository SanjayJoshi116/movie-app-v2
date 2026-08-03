import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Button, Tag, Typography, Empty, Space, Popconfirm, Input, Select, Tooltip,
} from "antd";
import { StarFilled, DeleteOutlined, EditOutlined, BookOutlined, DownloadOutlined, SearchOutlined, EyeOutlined, EyeFilled } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import { RatingModal } from "../components/watchlist/RatingModal";
import { MarkWatchedModal } from "../components/MarkWatchedModal";
import LibraryItemCard from "../components/LibraryItemCard";
import MediaGrid from "../components/MediaGrid";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import { pageVariants } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import type { MediaType, WatchlistEntry } from "../types";

const SS_SCROLL = "watchlist_scroll";
const SS_WATCHED_FILTER = "watchlist_watched_filter";

type WatchedFilter = "all" | "watched" | "unwatched";

const SORT_FNS: Record<string, (a: WatchlistEntry, b: WatchlistEntry) => number> = {
  "added-desc": (a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""),
  "added-asc": (a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""),
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "rating-desc": (a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0),
};

interface RatingTarget {
  id: number;
  type: string;
  title: string;
}

interface PendingWatch {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
}

function WatchlistPage() {
  const navigate = useNavigate();
  const {
    watchlist, removeFromWatchlist, clearAllWatchlist, getRating, setRating, isWatched, toggleWatched, theme,
  } = useAppContext();
  const { showSuccess, showError } = useToast();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [pendingWatch, setPendingWatch] = useState<PendingWatch | null>(null);
  const [watchedFilter, setWatchedFilter] = useState<WatchedFilter>(() => (sessionStorage.getItem(SS_WATCHED_FILTER) as WatchedFilter) ?? "all");
  const didRestoreScroll = useRef(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SS_SCROLL);
    if (saved && !didRestoreScroll.current) {
      didRestoreScroll.current = true;
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(saved, 10), behavior: "instant" });
        sessionStorage.removeItem(SS_SCROLL);
      });
    }
  }, []);

  useEffect(() => { sessionStorage.setItem(SS_WATCHED_FILTER, watchedFilter); }, [watchedFilter]);

  const { search, setSearch, sortKey, setSortKey, typeFilter, setTypeFilter, filtered, isDefault, resetFilters } =
    useLibraryFilters<WatchlistEntry>({
      keyPrefix: "watchlist",
      items: watchlist,
      sortFns: SORT_FNS,
      defaultSort: "added-desc",
      extraFilter:
        watchedFilter === "all"
          ? undefined
          : (i) => (watchedFilter === "watched" ? isWatched(i.id, i.type) : !isWatched(i.id, i.type)),
    });

  const handleExport = () => {
    const rows = watchlist.map((i) => ({
      title: i.title,
      type: i.type,
      tmdb_id: i.id,
      vote_average: i.voteAverage,
      added_at: i.addedAt,
      watched: isWatched(i.id, i.type),
    }));
    downloadCSV(rows, "watchlist.csv");
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Typography.Title level={2} style={{ margin: 0, flex: 1 }}>
          My Watchlist ({watchlist.length})
        </Typography.Title>
        {watchlist.length > 0 && (
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport} size="small">
              Export CSV
            </Button>
            <Popconfirm
              title="Clear entire watchlist?"
              description="This will permanently remove all items."
              onConfirm={async () => { await clearAllWatchlist(); showSuccess("Watchlist cleared"); }}
              okText="Clear All"
              okType="danger"
              cancelText="Cancel"
            >
              <Button danger icon={<DeleteOutlined />} size="small">
                Clear All
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>

      {watchlist.length > 0 && (
        <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <Input
            id="watchlist-search"
            name="search"
            autoComplete="off"
            prefix={<SearchOutlined />}
            placeholder="Search title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: "100%", maxWidth: 200 }}
          />
          <Select
            value={sortKey}
            onChange={setSortKey}
            style={{ width: "100%", maxWidth: 170 }}
            options={[
              { label: "Added (newest)", value: "added-desc" },
              { label: "Added (oldest)", value: "added-asc" },
              { label: "Title A–Z", value: "title-asc" },
              { label: "TMDB Rating ↓", value: "rating-desc" },
            ]}
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: "100%", maxWidth: 130 }}
            options={[
              { label: "All Types", value: "all" },
              { label: "Movies", value: "movie" },
              { label: "TV Shows", value: "tv" },
            ]}
          />
          <Select
            value={watchedFilter}
            onChange={setWatchedFilter}
            style={{ width: "100%", maxWidth: 150 }}
            options={[
              { label: "All", value: "all" },
              { label: "Watched", value: "watched" },
              { label: "Unwatched", value: "unwatched" },
            ]}
          />
          {(!isDefault || watchedFilter !== "all") && (
            <Button
              type="text"
              onClick={() => {
                resetFilters();
                setWatchedFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </Space>
      )}

      {watchlist.length === 0 ? (
        <Empty
          image={<BookOutlined style={{ fontSize: 48, color: "#f5c518" }} />}
          description="Your watchlist is empty. Browse movies and TV shows to add them."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/movies")}>Browse Movies</Button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty
          description={search.trim() ? `No results for "${search}"` : "No items match your filters."}
          style={{ padding: "40px 0" }}
        />
      ) : (
        <MediaGrid
          items={filtered}
          keyFn={(item) => `${item.type}-${item.id}`}
          renderCard={(item) => {
            const rating = getRating(item.id, item.type);
            const watched = isWatched(item.id, item.type);
            return (
              <LibraryItemCard
                posterPath={item.posterPath}
                title={item.title}
                onOpen={() => {
                  sessionStorage.setItem(SS_SCROLL, String(window.scrollY));
                  navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: "/watchlist" } });
                }}
                tags={
                  <>
                    <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0 }}>
                      {item.type === "movie" ? "Movie" : "TV"}
                    </Tag>
                    {item.voteAverage != null && (
                      <Tag color="gold" style={{ margin: 0 }}><StarFilled /> {item.voteAverage.toFixed(1)}</Tag>
                    )}
                    {rating && <Tag color="green" style={{ margin: 0 }}>My: {rating.userRating}/10</Tag>}
                  </>
                }
                actionButtons={
                  <>
                    <Tooltip title={watched ? "Mark unwatched" : "Mark watched"}>
                      <Button
                        type="text"
                        size="small"
                        icon={watched ? <EyeFilled /> : <EyeOutlined />}
                        style={{ color: watched ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000" }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (watched) {
                            try {
                              await toggleWatched({ id: item.id, type: item.type, title: item.title, posterPath: item.posterPath, voteAverage: item.voteAverage });
                              showSuccess("Removed from watched");
                            } catch (err) {
                              showError(getApiError(err, "Failed to update watched status."));
                            }
                          } else {
                            setPendingWatch({ id: item.id, type: item.type, title: item.title, posterPath: item.posterPath, voteAverage: item.voteAverage });
                          }
                        }}
                        aria-label={watched ? "Mark unwatched" : "Mark watched"}
                      />
                    </Tooltip>
                    <Tooltip title={rating ? "Edit rating" : "Rate"}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRatingTarget({ id: item.id, type: item.type, title: item.title });
                        }}
                        aria-label={rating ? "Edit rating" : "Rate"}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Remove from watchlist?"
                      onConfirm={async () => {
                        try {
                          await removeFromWatchlist(item.id, item.type);
                          showSuccess("Removed from watchlist");
                        } catch (err) {
                          showError(getApiError(err, "Failed to remove from watchlist."));
                        }
                      }}
                      okText="Remove"
                      cancelText="Cancel"
                    >
                      <Tooltip title="Remove">
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Remove from watchlist"
                        />
                      </Tooltip>
                    </Popconfirm>
                  </>
                }
                footer={
                  rating?.review && (
                    <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: FONT_SIZE.caption, color: "#aaa", marginTop: 6, marginBottom: 0 }}>
                      "{rating.review}"
                    </Typography.Paragraph>
                  )
                }
              />
            );
          }}
        />
      )}

      {ratingTarget && (
        <RatingModal
          title={ratingTarget.title}
          existing={getRating(ratingTarget.id, ratingTarget.type)}
          onSave={async (r, review) => {
            try {
              await setRating(ratingTarget.id, ratingTarget.type, ratingTarget.title, r, review);
              showSuccess("Rating saved");
            } catch (err) {
              showError(getApiError(err, "Failed to save rating."));
            }
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}

      <MarkWatchedModal
        open={pendingWatch !== null}
        mediaId={pendingWatch?.id ?? 0}
        mediaType={pendingWatch?.type ?? "movie"}
        onCancel={() => setPendingWatch(null)}
        onConfirm={(details) => {
          if (pendingWatch) {
            toggleWatched({ ...pendingWatch, ...details });
            showSuccess("Marked as watched");
          }
          setPendingWatch(null);
        }}
      />
    </motion.div>
  );
}

export default WatchlistPage;
