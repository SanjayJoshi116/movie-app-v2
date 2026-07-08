import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Tag, Typography, Empty, Space, Popconfirm, Input, Select, Tooltip,
} from "antd";
import { StarFilled, DeleteOutlined, EditOutlined, BookOutlined, DownloadOutlined, SearchOutlined, EyeOutlined, EyeFilled } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import { RatingModal } from "../components/watchlist/RatingModal";
import LibraryItemCard from "../components/LibraryItemCard";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import { pageVariants } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";

const SS_SCROLL = "watchlist_scroll";
const SS_SEARCH = "watchlist_search";
const SS_SORT   = "watchlist_sort";
const SS_TYPE_FILTER = "watchlist_type_filter";
const SS_WATCHED_FILTER = "watchlist_watched_filter";

type SortKey = "added-desc" | "added-asc" | "title-asc" | "rating-desc";
type TypeFilter = "all" | "movie" | "tv";
type WatchedFilter = "all" | "watched" | "unwatched";

interface RatingTarget {
  id: number;
  type: string;
  title: string;
}

function WatchlistPage() {
  const navigate = useNavigate();
  const { watchlist, removeFromWatchlist, clearAllWatchlist, getRating, setRating, markWatched } = useAppContext();
  const { showSuccess, showError } = useToast();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [search, setSearch] = useState(() => sessionStorage.getItem(SS_SEARCH) ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(() => (sessionStorage.getItem(SS_SORT) as SortKey) ?? "added-desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => (sessionStorage.getItem(SS_TYPE_FILTER) as TypeFilter) ?? "all");
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

  useEffect(() => { sessionStorage.setItem(SS_SEARCH, search); }, [search]);
  useEffect(() => { sessionStorage.setItem(SS_SORT, sortKey); }, [sortKey]);
  useEffect(() => { sessionStorage.setItem(SS_TYPE_FILTER, typeFilter); }, [typeFilter]);
  useEffect(() => { sessionStorage.setItem(SS_WATCHED_FILTER, watchedFilter); }, [watchedFilter]);

  const filtered = useMemo(() => {
    let items = [...watchlist];
    if (typeFilter !== "all") {
      items = items.filter((i) => i.type === typeFilter);
    }
    if (watchedFilter !== "all") {
      items = items.filter((i) => (watchedFilter === "watched" ? i.watched : !i.watched));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    switch (sortKey) {
      case "added-asc":  items.sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? "")); break;
      case "title-asc":  items.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "rating-desc": items.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0)); break;
      default:           items.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
    }
    return items;
  }, [watchlist, search, sortKey, typeFilter, watchedFilter]);

  const handleExport = () => {
    const rows = watchlist.map((i) => ({
      title: i.title,
      type: i.type,
      tmdb_id: i.id,
      vote_average: i.voteAverage,
      added_at: i.addedAt,
      watched: i.watched,
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
            prefix={<SearchOutlined />}
            placeholder="Search title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Select
            value={sortKey}
            onChange={setSortKey}
            style={{ width: 170 }}
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
            style={{ width: 130 }}
            options={[
              { label: "All Types", value: "all" },
              { label: "Movies", value: "movie" },
              { label: "TV Shows", value: "tv" },
            ]}
          />
          <Select
            value={watchedFilter}
            onChange={setWatchedFilter}
            style={{ width: 150 }}
            options={[
              { label: "All", value: "all" },
              { label: "Watched", value: "watched" },
              { label: "Unwatched", value: "unwatched" },
            ]}
          />
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
        <Row gutter={[16, 20]}>
          {filtered.map((item) => {
            const rating = getRating(item.id, item.type);
            return (
              <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4}>
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
                      {item.watched && <Tag color="cyan" style={{ margin: 0 }}>Watched</Tag>}
                    </>
                  }
                  actionButtons={
                    <>
                      <Tooltip title={item.watched ? "Mark unwatched" : "Mark watched"}>
                        <Button
                          type="text"
                          size="small"
                          icon={item.watched ? <EyeFilled /> : <EyeOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            markWatched(item.id, item.type, !item.watched);
                          }}
                          aria-label={item.watched ? "Mark unwatched" : "Mark watched"}
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
                        onConfirm={() => { removeFromWatchlist(item.id, item.type); showSuccess("Removed from watchlist"); }}
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
              </Col>
            );
          })}
        </Row>
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
    </motion.div>
  );
}

export default WatchlistPage;
