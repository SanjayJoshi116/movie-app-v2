import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Tag, Typography, Empty, Space, Popconfirm, Pagination, Select, Tooltip, theme } from "antd";
import { StarFilled, DeleteOutlined, EditOutlined, BookOutlined, DownloadOutlined, EyeOutlined, EyeFilled } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useWatchlistContext } from "../context/WatchlistContext";
import { useWatchedContext } from "../context/WatchedContext";
import { useToast } from "../hooks/useToast";
import { stashReturnState } from "../utils/browseReturnState";
import { RatingModal } from "../components/watchlist/RatingModal";
import { MarkWatchedModal } from "../components/MarkWatchedModal";
import LibraryItemCard from "../components/LibraryItemCard";
import SkeletonCard from "../components/SkeletonCard";
import { LoadError } from "../components/LoadError";
import MediaGrid from "../components/MediaGrid";
import { ConfirmIconButton } from "../components/ConfirmIconButton";
import FilterBar from "../components/FilterBar";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import { mediaLabel } from "../utils/mediaLabel";
import { pageVariants, RATING_GOLD, WATCHED_GREEN } from "../constants/ui";
import { useActionIconColor } from "../hooks/useActionIconColor";
import { FONT_SIZE } from "../constants/typography";
import type { MediaType, WatchlistEntry } from "../types";
import { usePageTitle } from "../hooks/usePageTitle";
import { useScrollBehavior } from "../hooks/useScrollBehavior";
import { parseIntParam } from "../utils/queryParams";

const SS_WATCHED_FILTER = "watchlist_watched_filter";

type WatchedFilter = "all" | "watched" | "unwatched";

// Same page sizes and URL params as the Watched page.
const PAGE_SIZES = [12, 24, 48, 96] as const;

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
  const scrollBehavior = useScrollBehavior();
  usePageTitle("Watchlist");
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const {
    watchlist, removeFromWatchlist, clearAllWatchlist, getRating, setRating, removeRating, isWatched, toggleWatched,
  } = useAppContext();
  const idleIconColor = useActionIconColor();
  const { isLoading, error: loadError, reload } = useWatchlistContext();
  const {
    hasLoaded: watchedLoaded, isLoading: watchedLoading, error: watchedError, reload: reloadWatched,
  } = useWatchedContext();
  const { showSuccess, showError } = useToast();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [pendingWatch, setPendingWatch] = useState<PendingWatch | null>(null);
  const [watchedFilter, setWatchedFilter] = useState<WatchedFilter>(() => (sessionStorage.getItem(SS_WATCHED_FILTER) as WatchedFilter) ?? "all");
  const didRestoreScroll = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Restore the scroll position only on a return from a title this list
  // opened: the detail page's in-app Back and (via stashReturnState) the
  // browser's Back both arrive with `isReturn`. Any other visit starts at the
  // top. (useNavigationType can't tell: App passes `location` to <Routes>,
  // which reports every in-route navigation as POP.)
  const location = useLocation();
  useEffect(() => {
    const state = location.state as { isReturn?: boolean; scrollY?: number } | null;
    if (didRestoreScroll.current || !state?.isReturn || !state.scrollY) return;
    didRestoreScroll.current = true;
    const y = state.scrollY;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "instant" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // A hand-edited ?page=-2 or ?pageSize=1.5 falls back instead of slicing oddly.
  const page = parseIntParam(searchParams.get("page"), { fallback: 1, min: 1 });
  const pageSize = parseIntParam(searchParams.get("pageSize"), { fallback: 48, allowed: PAGE_SIZES });

  const setPageState = (p: number, ps: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (p === 1) next.delete("page"); else next.set("page", String(p));
      if (ps === 48) next.delete("pageSize"); else next.set("pageSize", String(ps));
      return next;
    }, { replace: true });
  };

  // Removing (or filtering away) the last items on the last page would leave
  // a blank grid; move back to the last page that still has items. Only once
  // loaded, so a ?page=3 deep link isn't clamped against the initial empty list,
  // and, with the watched filter on, once the watched history it reads has
  // loaded too (it can arrive after the watchlist; a failed reload after that
  // keeps the loaded history, so the clamp still runs), and not while it
  // reloads (an import may be adding the titles this page is waiting for).
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const filterReady = watchedFilter === "all" || watchedLoaded;
  const filterSettled = watchedFilter === "all" || (watchedLoaded && !watchedLoading);
  useEffect(() => {
    if (!isLoading && !loadError && filterSettled && page > lastPage) setPageState(lastPage, pageSize);
  }, [isLoading, loadError, filterSettled, page, lastPage, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildFromUrl = () => {
    const p = new URLSearchParams();
    if (page > 1) p.set("page", String(page));
    if (pageSize !== 48) p.set("pageSize", String(pageSize));
    const qs = p.toString();
    return qs ? `/watchlist?${qs}` : "/watchlist";
  };

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

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
              onConfirm={async () => {
                try {
                  await clearAllWatchlist();
                  showSuccess("Watchlist cleared");
                } catch (err) {
                  showError(getApiError(err, "Failed to clear watchlist."));
                }
              }}
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
        <FilterBar
          search={{ value: search, onChange: (v) => { setSearch(v); setPageState(1, pageSize); }, id: "watchlist-search", placeholder: "Search title…" }}
          sort={{
            value: sortKey,
            onChange: (v) => { setSortKey(v); setPageState(1, pageSize); },
            maxWidth: 170,
            options: [
              { label: "Added (newest)", value: "added-desc" },
              { label: "Added (oldest)", value: "added-asc" },
              { label: "Title A–Z", value: "title-asc" },
              { label: "TMDB Rating ↓", value: "rating-desc" },
            ],
          }}
          typeFilter={{ value: typeFilter, onChange: (v) => { setTypeFilter(v); setPageState(1, pageSize); } }}
          extra={
            <Select
              value={watchedFilter}
              onChange={(v) => { setWatchedFilter(v); setPageState(1, pageSize); }}
              style={{ width: "100%", maxWidth: 150 }}
              options={[
                { label: "All", value: "all" },
                { label: "Watched", value: "watched" },
                { label: "Unwatched", value: "unwatched" },
              ]}
            />
          }
          showClear={!isDefault || watchedFilter !== "all"}
          onClear={() => {
            resetFilters();
            setWatchedFilter("all");
            setPageState(1, pageSize);
          }}
        />
      )}

      {watchlist.length === 0 && isLoading ? (
        <SkeletonCard count={12} />
      ) : watchlist.length === 0 && loadError ? (
        <LoadError title="Couldn't load your watchlist" onRetry={() => { reload().catch(() => {}); }} />
      ) : watchlist.length === 0 ? (
        <Empty
          image={<BookOutlined style={{ fontSize: 48, color: RATING_GOLD }} />}
          description="Your watchlist is empty. Browse movies and TV shows to add them."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/movies")}>Browse Movies</Button>
        </Empty>
      ) : !filterReady && watchedError && !watchedLoading ? (
        // The Watched/Unwatched filter reads the watched history: without it,
        // a filtered grid (or "no items match") would be made up. Once it has
        // loaded, a failed reload keeps that history and the grid. A retry in
        // progress shows the skeleton below, so Retry can't be clicked again.
        <LoadError title="Couldn't load your watched history" onRetry={() => { reloadWatched().catch(() => {}); }} />
      ) : !filterReady ? (
        <SkeletonCard count={12} />
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
            renderCard={(item) => {
              const rating = getRating(item.id, item.type);
              const watched = isWatched(item.id, item.type);
              // Shown and sent: the single-item endpoints refuse the blank
              // title a bulk import can store.
              const label = mediaLabel(item.title, item.id);
              return (
                <LibraryItemCard
                  posterPath={item.posterPath}
                  title={label}
                  to={`/${item.type}/${item.id}`}
                  onOpen={() => {
                    const scrollY = window.scrollY;
                    stashReturnState({ scrollY, isReturn: true });
                    navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: buildFromUrl(), scrollY } });
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
                          style={{ color: watched ? WATCHED_GREEN : idleIconColor }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (watched) {
                              try {
                                await toggleWatched({ id: item.id, type: item.type, title: label, posterPath: item.posterPath, voteAverage: item.voteAverage });
                                showSuccess("Removed from watched");
                              } catch (err) {
                                showError(getApiError(err, "Failed to update watched status."));
                              }
                            } else {
                              setPendingWatch({ id: item.id, type: item.type, title: label, posterPath: item.posterPath, voteAverage: item.voteAverage });
                            }
                          }}
                          aria-label={`${watched ? "Mark unwatched" : "Mark watched"}: ${label}`}
                        />
                      </Tooltip>
                      <Tooltip title={rating ? "Edit rating" : "Rate"}>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRatingTarget({ id: item.id, type: item.type, title: label });
                          }}
                          aria-label={`${rating ? "Edit rating" : "Rate"}: ${label}`}
                        />
                      </Tooltip>
                      <ConfirmIconButton
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
                        tooltip="Remove"
                        icon={<DeleteOutlined />}
                        danger
                        ariaLabel={`Remove from watchlist: ${label}`}
                      />
                    </>
                  }
                  footer={
                    rating?.review && (
                      <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: FONT_SIZE.caption, color: token.colorTextTertiary, marginTop: 6, marginBottom: 0 }}>
                        "{rating.review}"
                      </Typography.Paragraph>
                    )
                  }
                />
              );
            }}
          />

          {filtered.length > pageSize && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filtered.length}
                showSizeChanger
                pageSizeOptions={[...PAGE_SIZES]}
                onChange={(p, ps) => {
                  setPageState(ps !== pageSize ? 1 : p, ps);
                  window.scrollTo({ top: 0, behavior: scrollBehavior });
                }}
                showTotal={(total) => `${total} titles`}
              />
            </div>
          )}
        </>
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
              throw err;
            }
          }}
          onRemove={async () => {
            try {
              await removeRating(ratingTarget.id, ratingTarget.type);
              showSuccess("Rating removed");
            } catch (err) {
              showError(getApiError(err, "Failed to remove rating."));
              throw err;
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
        onConfirm={async (details) => {
          const target = pendingWatch;
          if (!target) return;
          try {
            await toggleWatched({ ...target, ...details });
            showSuccess("Marked as watched");
          } catch (err) {
            showError(getApiError(err, "Failed to mark as watched."));
            throw err; // the dialog stays open with what was typed
          }
          setPendingWatch(null);
        }}
      />
    </motion.div>
  );
}

export default WatchlistPage;
