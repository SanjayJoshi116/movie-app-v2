import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Card, Result, Skeleton, Space, Typography, theme } from "antd";
import { StarFilled, UndoOutlined } from "@ant-design/icons";
import { useWatchedContext } from "../context/WatchedContext";
import { useRatingsContext } from "../context/RatingsContext";
import { currentSessionGeneration, isCurrentSession } from "../api/userApi";
import { useToast } from "../hooks/useToast";
import { usePageTitle } from "../hooks/usePageTitle";
import { LoadError } from "../components/LoadError";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { getApiError } from "../utils/apiError";
import { mediaLabel } from "../utils/mediaLabel";
import { formatWatchedDate } from "../utils/formatDate";
import { buildRatingQueue, knownYear, sortByWatchedDesc, titleKey } from "../utils/ratingQueue";
import { FONT_SIZE } from "../constants/typography";
import { pageVariants, POSTER_URL } from "../constants/ui";
import type { MediaType, WatchedEntry } from "../types";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** A rating saved on this visit; `tap` orders the stack by when it was tapped. */
type Saved = { id: number; type: MediaType; tap: number };

/** Keys typed into a field, or pressed in a dialog, popover, menu or drawer
 *  open over the page, belong there, not to the queue behind it. */
function isForeignTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    || target.closest('[role="dialog"], [role="menu"], .ant-popover, .ant-dropdown, .ant-drawer') != null;
}

/**
 * Rate the watched titles that have no rating, one tap each. The queue is
 * built from the watched history and ratings already in memory; this page only
 * adds what the visit changes (titles saving or saved, skipped, put back).
 */
function RateQueuePage() {
  const { token } = theme.useToken();
  const { showError } = useToast();
  const watched = useWatchedContext();
  const ratings = useRatingsContext();

  const failed = (!watched.hasLoaded && !watched.isLoading && watched.error != null)
    || (!ratings.hasLoaded && !ratings.isLoading && ratings.error != null);
  const ready = watched.hasLoaded && ratings.hasLoaded;
  usePageTitle("Rate Watched Titles", { loading: !ready && !failed });

  // Titles saving or saved on this visit: out of the queue at once, before the
  // ratings list catches up. A failed save or an undo takes a title back out.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  // Put back by a failed save or an undo: shown first, newest first.
  const [front, setFront] = useState<string[]>([]);
  // Skipped this visit, in skip order: shown last.
  const [skipped, setSkipped] = useState<string[]>([]);
  // Ratings saved on this visit, in tap order (not the order saves finish):
  // what Undo steps back through.
  const [undoStack, setUndoStack] = useState<Saved[]>([]);
  const taps = useRef(0);
  const ratedCount = undoStack.length;
  const [undoing, setUndoing] = useState(false);

  // Sorted (and keyed) once per history change, not once per rating: a save
  // only changes which titles are unrated.
  const sorted = useMemo(() => sortByWatchedDesc(watched.watchedList), [watched.watchedList]);
  const unrated = useMemo(
    () => new Map(buildRatingQueue(sorted, (id, type) => ratings.get(id, type) != null).map((w) => [titleKey(w.id, w.type), w])),
    // `get` reads a ref; `ratings.ratings` is what changes.
    [sorted, ratings.ratings], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const queue = useMemo(() => {
    const order: WatchedEntry[] = [];
    const placed = new Set<string>();
    const place = (k: string) => {
      const w = unrated.get(k);
      if (w && !placed.has(k) && !hidden.has(k)) { order.push(w); placed.add(k); }
    };
    front.forEach(place);
    const skippedSet = new Set(skipped);
    unrated.forEach((_, k) => { if (!skippedSet.has(k)) place(k); });
    skipped.forEach(place);
    return order;
  }, [unrated, front, skipped, hidden]);

  const current = queue[0] ?? null;

  const putBack = (k: string) => {
    setHidden((prev) => { const next = new Set(prev); next.delete(k); return next; });
    setSkipped((prev) => prev.filter((x) => x !== k));
    setFront((prev) => [k, ...prev.filter((x) => x !== k)]);
  };

  const rate = (entry: WatchedEntry, score: number) => {
    const k = titleKey(entry.id, entry.type);
    const gen = currentSessionGeneration();
    const tap = ++taps.current;
    setHidden((prev) => new Set(prev).add(k));
    setFront((prev) => prev.filter((x) => x !== k));
    ratings.set(entry.id, entry.type, mediaLabel(entry.title, entry.id), score).then(
      () => {
        if (!isCurrentSession(gen)) return;
        setUndoStack((prev) => [...prev, { id: entry.id, type: entry.type, tap }].sort((a, b) => a.tap - b.tap));
      },
      (err: unknown) => {
        if (!isCurrentSession(gen)) return;
        showError(getApiError(err, `Couldn't save the rating for ${mediaLabel(entry.title, entry.id)}.`));
        putBack(k);
      },
    );
  };

  const skip = (entry: WatchedEntry) => {
    const k = titleKey(entry.id, entry.type);
    setFront((prev) => prev.filter((x) => x !== k));
    setSkipped((prev) => [...prev.filter((x) => x !== k), k]);
  };

  const undo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last || undoing) return;
    const gen = currentSessionGeneration();
    setUndoing(true);
    try {
      await ratings.remove(last.id, last.type);
      if (!isCurrentSession(gen)) return;
      // This entry, not whatever is last now: a save can finish meanwhile.
      setUndoStack((prev) => prev.filter((s) => s.tap !== last.tap));
      putBack(titleKey(last.id, last.type));
    } catch (err) {
      if (isCurrentSession(gen)) showError(getApiError(err, "Couldn't undo the last rating."));
    } finally {
      if (isCurrentSession(gen)) setUndoing(false);
    }
  };

  // Shortcuts read the latest render through a ref, so the listener is added once.
  const actions = useRef({ current, rate, skip, undo });
  actions.current = { current, rate, skip, undo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A held key repeats: one press, one rating.
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isForeignTarget(e.target)) return;
      const { current: entry, rate: doRate, skip: doSkip, undo: doUndo } = actions.current;
      const key = e.key.toLowerCase();
      if (key === "u") { e.preventDefault(); doUndo(); return; }
      if (!entry) return;
      if (/^[0-9]$/.test(key)) { e.preventDefault(); doRate(entry, key === "0" ? 10 : Number(key)); }
      else if (key === "s") { e.preventDefault(); doSkip(entry); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const retry = () => {
    if (!watched.hasLoaded) watched.reload().catch(() => {});
    if (!ratings.hasLoaded) ratings.reload().catch(() => {});
  };

  const undoButton = undoStack.length > 0 && (
    <Button icon={<UndoOutlined />} onClick={undo} loading={undoing} aria-keyshortcuts="U">
      Undo last rating
    </Button>
  );

  let body: React.ReactNode;
  if (failed) {
    body = <LoadError title="Couldn't load your watched titles and ratings" onRetry={retry} />;
  } else if (!ready) {
    body = <Skeleton active avatar={{ shape: "square", size: 160 }} paragraph={{ rows: 4 }} />;
  } else if (!current) {
    body = (
      <Result
        icon={<StarFilled className="accent-figure" />}
        title="All caught up"
        subTitle={ratedCount > 0
          ? `You rated ${ratedCount} title${ratedCount === 1 ? "" : "s"}. Every watched title has a rating.`
          : "Every watched title has a rating."}
        extra={<Space wrap>{undoButton}<Link to="/watched">Back to Watched</Link></Space>}
      />
    );
  } else {
    const label = mediaLabel(current.title, current.id);
    const year = knownYear(current.releaseYear);
    body = (
      <Card className="rate-queue-card">
        <div className="rate-queue-title">
          {current.posterPath ? (
            <img src={`${POSTER_URL}${current.posterPath}`} alt="" className="rate-queue-poster" />
          ) : (
            <PosterPlaceholder className="rate-queue-poster" style={{ aspectRatio: "2 / 3" }} aria-hidden />
          )}
          <div>
            <Typography.Title level={3} style={{ margin: 0 }} id="rate-queue-current">
              {label}{year ? ` (${year})` : ""}
            </Typography.Title>
            <Typography.Text type="secondary">
              {current.type === "tv" ? "TV show" : "Movie"} · watched {formatWatchedDate(current.watchedAt, current.watchedTz)}
            </Typography.Text>
          </div>
        </div>
        <div className="rate-queue-scores" role="group" aria-labelledby="rate-queue-current">
          {SCORES.map((n) => (
            <Button
              key={n}
              onClick={() => rate(current, n)}
              aria-label={`Rate ${label} ${n} out of 10`}
              aria-keyshortcuts={n === 10 ? "0" : String(n)}
              style={{ fontSize: FONT_SIZE.emphasis }}
            >
              {n}
            </Button>
          ))}
        </div>
        <Space wrap style={{ marginTop: 16 }}>
          <Button onClick={() => skip(current)} aria-keyshortcuts="S">Skip</Button>
          {undoButton}
        </Space>
      </Card>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
      <Typography.Title level={2} style={{ marginTop: 0 }}>Rate your watched titles</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ maxWidth: 640 }}>
        Tap a score, or press 1–9 (0 for 10). S skips, U undoes. Ratings shape your recommendations;
        for half points or a review, rate from the title's page.
      </Typography.Paragraph>
      {ready && !failed && (
        <Typography.Paragraph style={{ color: token.colorTextSecondary }} aria-live="polite">
          {ratedCount} rated · {queue.length} left
        </Typography.Paragraph>
      )}
      {body}
    </motion.div>
  );
}

export default RateQueuePage;
