import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Button, Tag, Typography, Empty, Space, Popconfirm, Pagination, Select, Tooltip,
} from "antd";
import { StarFilled, EyeFilled, EyeOutlined, ClearOutlined, DownloadOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useWatchedContext } from "../context/WatchedContext";
import { useToast } from "../hooks/useToast";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import { formatDateDMY } from "../utils/formatDate";
import { InfoTooltip } from "../components/InfoTooltip";
import LibraryItemCard from "../components/LibraryItemCard";
import SkeletonCard from "../components/SkeletonCard";
import { LoadError } from "../components/LoadError";
import MediaGrid from "../components/MediaGrid";
import FilterBar from "../components/FilterBar";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { FONT_SIZE } from "../constants/typography";
import { pageVariants, WATCHED_GREEN } from "../constants/ui";
import type { WatchedEntry } from "../types";

const SORT_FNS: Record<string, (a: WatchedEntry, b: WatchedEntry) => number> = {
  "watched-desc": (a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""),
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "tmdb-desc": (a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0),
};

function WatchedPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { watchedList, removeFromWatched, clearAllWatched, getRating } = useAppContext();
  const { isLoading, error: loadError, reload } = useWatchedContext();
  const { showSuccess, showError } = useToast();
  const [clearing, setClearing] = useState(false);

  const sortFns: Record<string, (a: WatchedEntry, b: WatchedEntry) => number> = {
    ...SORT_FNS,
    "my-rating-desc": (a, b) => (getRating(b.id, b.type)?.userRating ?? 0) - (getRating(a.id, a.type)?.userRating ?? 0),
  };

  const { search, setSearch, sortKey, setSortKey, typeFilter, setTypeFilter, filtered, isDefault, resetFilters } =
    useLibraryFilters<WatchedEntry>({
      keyPrefix: "watched",
      items: watchedList,
      sortFns,
      defaultSort: "watched-desc",
    });

  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "48") || 48;

  const setPageState = (p: number, ps: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (p === 1) next.delete("page"); else next.set("page", String(p));
      if (ps === 48) next.delete("pageSize"); else next.set("pageSize", String(ps));
      return next;
    }, { replace: true });
  };

  const buildFromUrl = () => {
    const p = new URLSearchParams();
    if (page > 1) p.set("page", String(page));
    if (pageSize !== 48) p.set("pageSize", String(pageSize));
    const qs = p.toString();
    return qs ? `/watched?${qs}` : "/watched";
  };

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const movies = watchedList.filter((w) => w.type === "movie");
  const tvShows = watchedList.filter((w) => w.type === "tv");

  const handleExport = () => {
    const rows = watchedList.map((i) => ({
      title: i.title,
      type: i.type,
      tmdb_id: i.id,
      vote_average: i.voteAverage,
      watched_at: i.watchedAt,
    }));
    downloadCSV(rows, "watched.csv");
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <EyeFilled style={{ color: "#52c41a", fontSize: 24 }} />
        <Typography.Title level={2} style={{ margin: 0, flex: 1 }}>
          Watched ({watchedList.length})
        </Typography.Title>
        {watchedList.length > 0 && (
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport} size="small">
              Export CSV
            </Button>
            <Popconfirm
              title="Clear all watched?"
              description="This will permanently remove all watched entries."
              onConfirm={async () => {
                setClearing(true);
                try {
                  await clearAllWatched();
                  showSuccess("Cleared all watched entries.");
                } catch (err) {
                  showError(getApiError(err, "Failed to clear watched list."));
                } finally {
                  setClearing(false);
                }
              }}
              okText="Clear All"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
            >
              <Button danger icon={<ClearOutlined />} loading={clearing}>
                Clear All
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>

      {watchedList.length > 0 && (
        <Space size={16} style={{ marginBottom: 16 }}>
          <Tag color="blue">{movies.length} movie{movies.length !== 1 ? "s" : ""}</Tag>
          <Tag color="purple">{tvShows.length} TV show{tvShows.length !== 1 ? "s" : ""}</Tag>
        </Space>
      )}

      {watchedList.length > 0 && (
        <FilterBar
          search={{
            value: search,
            onChange: (v) => { setSearch(v); setPageState(1, pageSize); },
            id: "watched-search",
            placeholder: "Search title…",
          }}
          sort={{
            value: sortKey,
            onChange: (v) => { setSortKey(v); setPageState(1, pageSize); },
            maxWidth: 180,
            options: [
              { label: "Watched (newest)", value: "watched-desc" },
              { label: "Title A–Z", value: "title-asc" },
              { label: "TMDB Rating ↓", value: "tmdb-desc" },
              { label: "My Rating ↓", value: "my-rating-desc" },
            ],
          }}
          typeFilter={{ value: typeFilter, onChange: (v) => { setTypeFilter(v); setPageState(1, pageSize); } }}
          extra={<InfoTooltip title="TMDB Rating is the public community score; My Rating is your personal rating." />}
          showClear={!isDefault}
          onClear={() => {
            resetFilters();
            setPageState(1, pageSize);
          }}
        />
      )}

      {watchedList.length === 0 && isLoading ? (
        <SkeletonCard count={12} />
      ) : watchedList.length === 0 && loadError ? (
        <LoadError title="Couldn't load your watched history" onRetry={() => { reload().catch(() => {}); }} />
      ) : watchedList.length === 0 ? (
        <Empty
          image={<EyeOutlined style={{ fontSize: 48, color: "#52c41a" }} />}
          description="Nothing marked as watched yet. Browse movies and TV shows and click the eye icon."
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
        <>
          <MediaGrid
            items={paginated}
            keyFn={(item) => `${item.type}-${item.id}`}
            renderCard={(item) => (
              <LibraryItemCard
                posterPath={item.posterPath}
                title={item.title}
                onOpen={() =>
                  navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: buildFromUrl() } })
                }
                tags={
                  <>
                    <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0 }}>
                      {item.type === "movie" ? "Movie" : "TV"}
                    </Tag>
                    {item.voteAverage != null && (
                      <Tag color="gold" style={{ margin: 0 }}><StarFilled /> {item.voteAverage.toFixed(1)}</Tag>
                    )}
                  </>
                }
                actionButtons={
                  <Popconfirm
                    title="Mark as unwatched?"
                    onConfirm={async () => {
                      try {
                        await removeFromWatched(item.id, item.type);
                        showSuccess("Marked as unwatched");
                      } catch (err) {
                        showError(getApiError(err, "Failed to mark as unwatched."));
                      }
                    }}
                    okText="Mark Unwatched"
                    cancelText="Cancel"
                  >
                    <Tooltip title="Mark unwatched">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeFilled />}
                        style={{ color: WATCHED_GREEN }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Mark as unwatched"
                      />
                    </Tooltip>
                  </Popconfirm>
                }
                footer={
                  <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption, display: "block", marginTop: 6 }}>
                    {formatDateDMY(item.watchedAt)}
                  </Typography.Text>
                }
              />
            )}
          />

          {filtered.length > pageSize && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filtered.length}
                showSizeChanger
                pageSizeOptions={[12, 24, 48, 96]}
                onChange={(p, ps) => {
                  setPageState(ps !== pageSize ? 1 : p, ps);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                showTotal={(total) => `${total} titles`}
              />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

export default WatchedPage;
