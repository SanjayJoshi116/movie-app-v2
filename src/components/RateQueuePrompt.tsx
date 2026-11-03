import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Alert } from "antd";
import { useWatchedContext } from "../context/WatchedContext";
import { useRatingsContext } from "../context/RatingsContext";
import { countUnrated } from "../utils/ratingQueue";

interface Props {
  /** Show only from this many unrated titles. */
  minCount: number;
  /** "watched": the Watched page's count line; "recommendations": why rating helps. */
  variant: "watched" | "recommendations";
}

/**
 * Points to the rate page when watched titles have no rating. Counts only
 * once the watched history and the ratings have both loaded, the same rule
 * the rate page builds its queue with.
 */
export function RateQueuePrompt({ minCount, variant }: Props) {
  const { watchedList, hasLoaded: watchedLoaded } = useWatchedContext();
  const { ratings, get, hasLoaded: ratingsLoaded } = useRatingsContext();
  const count = useMemo(
    () => countUnrated(watchedList, (id, type) => get(id, type) != null),
    // `get` reads a ref; `ratings` is what changes.
    [watchedList, ratings], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!watchedLoaded || !ratingsLoaded || count < Math.max(1, minCount)) return null;

  const plural = count === 1 ? "" : "s";
  const message = variant === "watched"
    ? `${count} watched title${plural} ${count === 1 ? "isn't" : "aren't"} rated`
    : `Rate what you've watched to improve these: ${count} watched title${plural} ${count === 1 ? "has" : "have"} no rating`;
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      message={message}
      action={<Link to="/watched/rate">Rate them</Link>}
    />
  );
}
