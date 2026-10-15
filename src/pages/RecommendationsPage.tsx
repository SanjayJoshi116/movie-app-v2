import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Alert, Row, Col, Card, Tag, Button, Typography, Empty, Spin, Divider, Tooltip, theme } from "antd";
import { StarFilled, BulbOutlined, SearchOutlined, EyeOutlined, EyeFilled, BookOutlined, BookFilled } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useWatchlistContext } from "../context/WatchlistContext";
import { useWatchedContext } from "../context/WatchedContext";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";
import {
  fetchForYouRecommendations,
  fetchPersonalizedRecommendations,
  fetchFollowedPeopleRecommendations,
  saveSessionCache,
  type PersonalizedRecSection,
  type PersonalizedRecItem,
} from "../api/userApi";
import { POSTER_URL, pageVariants, RATING_GOLD, WATCHED_GREEN, IN_WATCHLIST_BLUE } from "../constants/ui";
import { useActionIconColor } from "../hooks/useActionIconColor";
import { ratingColor } from "../utils/colors";
import { InfoTooltip } from "../components/InfoTooltip";
import { MarkWatchedModal } from "../components/MarkWatchedModal";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { LoadError } from "../components/LoadError";
import FilterBar from "../components/FilterBar";
import type { LibraryTypeFilter } from "../hooks/useLibraryFilters";
import { FONT_SIZE } from "../constants/typography";
import CardLink from "../components/CardLink";
import { usePageTitle } from "../hooks/usePageTitle";

const SS_SEARCH = "foryou_search";
const SS_TYPE_FILTER = "foryou_type_filter";

type NavigateFn = (path: string, opts?: object) => void;

/** `from` is the page hosting the card: the detail page's Back returns there. */
const RecCard = memo(function RecCard({ item, navigate, from }: { item: PersonalizedRecSection["items"][number]; navigate: NavigateFn; from: string }) {
  const path = `/${item.type === "movie" ? "movie" : "tv"}/${item.id}`;
  const idleIconColor = useActionIconColor();
  const { isIn: isInWatchlist, toggle: toggleWatchlist } = useWatchlistContext();
  const { isWatched, toggle: toggleWatched } = useWatchedContext();
  const { showSuccess, showError } = useToast();
  const [showMarkWatchedModal, setShowMarkWatchedModal] = useState(false);
  return (
    <>
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card
        hoverable
        className="glass-card"
        onClick={() => navigate(path, { state: { from } })}
        cover={
          // Poster-only link (the card has its own buttons); the card's mouse
          // onClick stays, so stop the click there.
          <CardLink to={path} state={{ from }} label={item.title} stopPropagation>
            {item.posterPath ? (
              <img
                src={`${POSTER_URL}${item.posterPath}`}
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
          title={<span style={{ fontSize: FONT_SIZE.emphasis, lineHeight: "1.3", display: "block" }}>{item.title}</span>}
          description={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Tag color={ratingColor(item.voteAverage)} style={{ margin: 0 }}>
                <StarFilled style={{ marginRight: 2 }} />
                {item.voteAverage.toFixed(1)}
              </Tag>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip title={isWatched(item.id, item.type) ? "Unmark watched" : "Mark as watched"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isWatched(item.id, item.type) ? <EyeFilled /> : <EyeOutlined />}
                    style={{ color: isWatched(item.id, item.type) ? WATCHED_GREEN : idleIconColor }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (isWatched(item.id, item.type)) {
                        try {
                          await toggleWatched({ id: item.id, type: item.type, title: item.title, posterPath: item.posterPath, voteAverage: item.voteAverage });
                          showSuccess("Removed from watched");
                        } catch (err) {
                          showError(getApiError(err, "Failed to update watched status."));
                        }
                      } else {
                        setShowMarkWatchedModal(true);
                      }
                    }}
                    aria-label={`${isWatched(item.id, item.type) ? "Unmark watched" : "Mark as watched"}: ${item.title}`}
                  />
                </Tooltip>
                <Tooltip title={isInWatchlist(item.id, item.type) ? "Remove from watchlist" : "Add to watchlist"}>
                  <Button
                    size="small"
                    type="text"
                    icon={isInWatchlist(item.id, item.type) ? <BookFilled /> : <BookOutlined />}
                    style={{ color: isInWatchlist(item.id, item.type) ? IN_WATCHLIST_BLUE : idleIconColor }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const inList = isInWatchlist(item.id, item.type);
                      try {
                        await toggleWatchlist({ id: item.id, type: item.type, title: item.title, posterPath: item.posterPath, voteAverage: item.voteAverage });
                        showSuccess(inList ? "Removed from watchlist" : "Added to watchlist");
                      } catch (err) {
                        showError(getApiError(err, "Failed to update watchlist."));
                      }
                    }}
                    aria-label={`${isInWatchlist(item.id, item.type) ? "Remove from watchlist" : "Add to watchlist"}: ${item.title}`}
                  />
                </Tooltip>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={(e) => { e.stopPropagation(); navigate(path, { state: { from } }); }}
                  aria-label={`Details for ${item.title}`}
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
      mediaId={item.id}
      mediaType={item.type}
      onCancel={() => setShowMarkWatchedModal(false)}
      onConfirm={async (details) => {
        try {
          await toggleWatched({ id: item.id, type: item.type, title: item.title, posterPath: item.posterPath, voteAverage: item.voteAverage, ...details });
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
});

export function SectionRow({ section, navigate, from = "/recommendations" }: { section: PersonalizedRecSection; navigate: NavigateFn; from?: string }) {
  return (
    <div key={section.key}>
      <Divider orientation="left">
        <Typography.Text strong style={{ fontSize: FONT_SIZE.emphasis }}>{section.label}</Typography.Text>
      </Divider>
      <Row gutter={[16, 20]} style={{ marginBottom: 8 }}>
        {section.items.map((item) => (
          <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4} xl={4}>
            <RecCard item={item} navigate={navigate} from={from} />
          </Col>
        ))}
      </Row>
    </div>
  );
}

const REC_CACHE_KEY = "cinedb_recommendations";

/** A polled group: still computing, answered ready, or polling stopped first. */
type GroupState = "pending" | "ready" | "gaveUp";
type RecGroup = "forYou" | "personalized" | "followed";
const NO_FAILED_GROUPS: ReadonlySet<RecGroup> = new Set();
const REC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface RecCache {
  sections: PersonalizedRecSection[];
  personalizedSections: PersonalizedRecSection[];
  followedSections: PersonalizedRecSection[];
  scrollY: number;
  ts: number;
  /** False if any group was still loading/computing when saved (missing on old caches). */
  complete?: boolean;
}

function hasAnyItems(c: RecCache): boolean {
  return [c.sections, c.personalizedSections, c.followedSections].some(
    list => list.some(s => s.items.length > 0),
  );
}

function readRecCache(): RecCache | null {
  try {
    const raw = sessionStorage.getItem(REC_CACHE_KEY);
    if (!raw) return null;
    const parsed: RecCache = JSON.parse(raw);
    if (Date.now() - parsed.ts > REC_CACHE_TTL) return null;
    // An empty snapshot means we left mid-computation last time — treat as a
    // cache miss so the fetch/poll effect runs again instead of showing a
    // permanent empty state.
    if (!hasAnyItems(parsed)) return null;
    return parsed;
  } catch { return null; }
}

function RecommendationsPage() {
  usePageTitle("For You");
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { watchedList, isDataLoading, watchedError, reloadWatched } = useAppContext();

  const [search, setSearch] = useState(() => sessionStorage.getItem(SS_SEARCH) ?? "");
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>(() => (sessionStorage.getItem(SS_TYPE_FILTER) as LibraryTypeFilter) ?? "all");

  useEffect(() => { sessionStorage.setItem(SS_SEARCH, search); }, [search]);
  useEffect(() => { sessionStorage.setItem(SS_TYPE_FILTER, typeFilter); }, [typeFilter]);

  const filterItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items: PersonalizedRecItem[]) =>
      items.filter((i) => (typeFilter === "all" || i.type === typeFilter) && (!q || i.title.toLowerCase().includes(q)));
  }, [search, typeFilter]);

  const [cache] = useState<RecCache | null>(readRecCache);

  const [sections, setSections] = useState<PersonalizedRecSection[]>(cache?.sections ?? []);
  const [personalizedSections, setPersonalizedSections] = useState<PersonalizedRecSection[]>(cache?.personalizedSections ?? []);
  const [followedSections, setFollowedSections] = useState<PersonalizedRecSection[]>(cache?.followedSections ?? []);
  const [loading, setLoading] = useState(!cache);
  // What each polled group last answered in this visit. Only a complete saved
  // snapshot starts "ready"; anything else must be answered again first.
  const initialGroup: GroupState = cache?.complete ? "ready" : "pending";
  const [forYouState, setForYouState] = useState<GroupState>(initialGroup);
  const [personalizedState, setPersonalizedState] = useState<GroupState>(initialGroup);
  const [followedAnswered, setFollowedAnswered] = useState(Boolean(cache?.complete));
  // Groups whose request failed in this visit. A failed group stays "pending",
  // but only the groups still being prepared count as computing.
  const [failedGroups, setFailedGroups] = useState<ReadonlySet<RecGroup>>(NO_FAILED_GROUPS);
  const fetchError = failedGroups.size > 0;
  const [retryToken, setRetryToken] = useState(0);
  const computing =
    (forYouState === "pending" && !failedGroups.has("forYou")) ||
    (personalizedState === "pending" && !failedGroups.has("personalized"));
  const gaveUp = forYouState === "gaveUp" || personalizedState === "gaveUp";
  const hasWatched = watchedList.length > 0;
  // An incomplete snapshot (left mid-computation) is shown but not trusted:
  // the fetch/poll effect still runs and replaces it once the backend is ready.
  const hasFetched = useRef(Boolean(cache?.complete));

  // Restore scroll once on mount if cache hit — rAF fires after browser's own scroll restoration
  useEffect(() => {
    if (!cache?.scrollY) return;
    const id = requestAnimationFrame(() => window.scrollTo(0, cache.scrollY));
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref to latest data so unmount cleanup captures current values.
  // Complete only once every group answered "ready" in this visit: leaving
  // before that (or after polling gave up) must not cache partial groups as final.
  const complete = forYouState === "ready" && personalizedState === "ready" && followedAnswered && !fetchError;
  const latestData = useRef({ sections, personalizedSections, followedSections, complete });
  useEffect(() => { latestData.current = { sections, personalizedSections, followedSections, complete }; });

  // Save to sessionStorage on unmount
  useEffect(() => {
    return () => {
      const { sections: s, personalizedSections: ps, followedSections: fs, complete: c } = latestData.current;
      saveSessionCache(REC_CACHE_KEY, JSON.stringify({
        sections: s, personalizedSections: ps, followedSections: fs,
        scrollY: window.scrollY,
        ts: Date.now(),
        complete: c,
      }));
    };
  }, []);

  // Depends on whether there is any watched title, not how many: marking a
  // card watched here must not refetch and reshuffle every group.
  useEffect(() => {
    if (isDataLoading || !hasWatched || hasFetched.current) return;
    hasFetched.current = true;
    setFailedGroups(NO_FAILED_GROUPS);
    let cancelled = false;
    const fail = (group: RecGroup) => setFailedGroups((prev) => new Set(prev).add(group));
    let pending = 3;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const done = () => { if (--pending === 0 && !cancelled) setLoading(false); };

    const POLL_INTERVAL_MS = 3000;
    const MAX_POLLS = 20; // ~1 minute of polling before giving up

    // for-you and personalized are cache-backed and computed in a bg thread on
    // first request — poll until the backend flips status from "pending" to "ready".
    function pollRecommendation(
      fetchFn: () => Promise<{ data: { status: string; sections: PersonalizedRecSection[] } }>,
      setter: (s: PersonalizedRecSection[]) => void,
      setGroupState: (v: GroupState) => void,
      group: RecGroup,
      attempt: number,
    ) {
      fetchFn()
        .then(res => {
          if (cancelled) return;
          setter(res.data.sections);
          if (res.data.status !== "pending") {
            setGroupState("ready");
          } else if (attempt < MAX_POLLS) {
            setGroupState("pending");
            timeouts.push(setTimeout(
              () => pollRecommendation(fetchFn, setter, setGroupState, group, attempt + 1),
              POLL_INTERVAL_MS,
            ));
          } else {
            // Still computing after the last poll: not final, say so.
            setGroupState("gaveUp");
          }
        })
        .catch(() => { if (!cancelled) fail(group); })
        .finally(() => { if (attempt === 0) done(); });
    }

    pollRecommendation(fetchForYouRecommendations, setSections, setForYouState, "forYou", 0);
    pollRecommendation(fetchPersonalizedRecommendations, setPersonalizedSections, setPersonalizedState, "personalized", 0);

    fetchFollowedPeopleRecommendations()
      .then(res => { if (!cancelled) { setFollowedSections(res.data); setFollowedAnswered(true); } })
      .catch(() => { if (!cancelled) fail("followed"); })
      .finally(done);

    return () => {
      cancelled = true;
      hasFetched.current = false; // allow retry on StrictMode re-mount
      timeouts.forEach(clearTimeout);
    };
  }, [isDataLoading, hasWatched, retryToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    hasFetched.current = false;
    setFailedGroups(NO_FAILED_GROUPS);
    setForYouState("pending");
    setPersonalizedState("pending");
    setFollowedAnswered(false);
    setLoading(true);
    setRetryToken((t) => t + 1);
  };

  const totalItems =
    sections.reduce((acc, s) => acc + s.items.length, 0) +
    personalizedSections.reduce((acc, s) => acc + s.items.length, 0) +
    followedSections.reduce((acc, s) => acc + s.items.length, 0);

  const toFilteredSections = (list: PersonalizedRecSection[]) =>
    list
      .map((s) => ({ ...s, items: filterItems(s.items) }))
      .filter((s) => s.items.length > 0);

  const filteredFollowed = toFilteredSections(followedSections);
  const filteredPersonalized = toFilteredSections(personalizedSections);
  const filteredForYou = toFilteredSections(sections);
  const totalFilteredItems =
    filteredFollowed.reduce((acc, s) => acc + s.items.length, 0) +
    filteredPersonalized.reduce((acc, s) => acc + s.items.length, 0) +
    filteredForYou.reduce((acc, s) => acc + s.items.length, 0);

  const hasActiveFilters = search.trim() !== "" || typeFilter !== "all";

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Typography.Title level={2} style={{ marginBottom: 8 }}>
        For You
        <InfoTooltip title="Built from your own activity: titles like the ones you watched and rated well, picks from the genres you watch most, and new work from people you follow." />
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Recommendations based on {watchedList.length} watched title{watchedList.length !== 1 ? "s" : ""}
      </Typography.Text>

      {totalItems > 0 && (
        <FilterBar
          search={{ value: search, onChange: setSearch, id: "recommendations-search", placeholder: "Search title…" }}
          typeFilter={{ value: typeFilter, onChange: setTypeFilter }}
          showClear={hasActiveFilters}
          onClear={() => { setSearch(""); setTypeFilter("all"); }}
        />
      )}

      {isDataLoading ? (
        <Spin size="large" style={{ display: "block", margin: "80px auto" }} />
      ) : watchedError != null && watchedList.length === 0 ? (
        <LoadError
          title="Couldn't load your watched titles"
          onRetry={() => { reloadWatched().catch(() => {}); }}
        />
      ) : watchedList.length === 0 ? (
        <Empty
          image={<BulbOutlined style={{ fontSize: 48, color: RATING_GOLD }} />}
          description={
            <span>
              No watched titles yet.{" "}
              <Button type="link" onClick={() => navigate("/movies")} style={{ padding: 0 }}>
                Browse movies
              </Button>{" "}
              or{" "}
              <Button type="link" onClick={() => navigate("/tv")} style={{ padding: 0 }}>
                TV shows
              </Button>{" "}
              and mark them as watched.
            </span>
          }
          style={{ padding: "60px 0" }}
        />
      ) : (
        <>
          {loading && totalItems === 0 && (
            <Spin size="large" style={{ display: "block", margin: "80px auto" }} />
          )}
          {fetchError && (totalItems > 0 || computing) && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Some recommendations couldn't be loaded."
              action={<Button size="small" onClick={retry}>Retry</Button>}
            />
          )}
          {gaveUp && !fetchError && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Recommendations are taking longer than usual."
              description="Some groups are still being prepared."
              action={<Button size="small" onClick={retry}>Retry</Button>}
            />
          )}
          {filteredFollowed.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {filteredPersonalized.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {filteredForYou.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {!loading && totalItems > 0 && totalFilteredItems === 0 && (
            <Empty
              image={<SearchOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
              description="No recommendations match your filters."
              style={{ padding: "60px 0" }}
            />
          )}
          {!loading && totalItems === 0 && computing && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Spin size="large" />
              <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
                Crunching your watch history — this can take a minute for large lists.
              </Typography.Paragraph>
            </div>
          )}
          {!loading && totalItems === 0 && !computing && fetchError && (
            <LoadError title="Couldn't load recommendations" onRetry={retry} />
          )}
          {!loading && totalItems === 0 && !computing && !gaveUp && !fetchError && (
            <Empty
              image={<BulbOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
              description="No recommendations found for your watched titles."
              style={{ padding: "60px 0" }}
            />
          )}
        </>
      )}
    </motion.div>
  );
}

export default RecommendationsPage;
