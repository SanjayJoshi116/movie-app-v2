import type { WatchedEntry } from "../types";

export { titleKey } from "./titleKey";

type HasRating = (id: number, type: string) => boolean;

/** The watched history, most recently watched first (TMDB id breaks ties).
 *  Each time is parsed once, not once per comparison. */
export function sortByWatchedDesc(watched: readonly WatchedEntry[]): WatchedEntry[] {
  return watched
    .map((w) => ({ w, t: Date.parse(w.watchedAt) }))
    .sort((a, b) => b.t - a.t || b.w.id - a.w.id)
    .map(({ w }) => w);
}

/**
 * The rate page's queue: every watched title without a rating, movies and TV
 * together, in the order given. The page passes `sortByWatchedDesc`'s result,
 * sorted once per history change, so a save only re-filters.
 */
export function buildRatingQueue(sorted: readonly WatchedEntry[], hasRating: HasRating): WatchedEntry[] {
  return sorted.filter((w) => !hasRating(w.id, w.type));
}

/** How many watched titles have no rating (the entry prompts' count). */
export function countUnrated(watched: readonly WatchedEntry[], hasRating: HasRating): number {
  return watched.reduce((n, w) => (hasRating(w.id, w.type) ? n : n + 1), 0);
}

/** A release year worth showing: the backend stores -1 when it's unknown. */
export function knownYear(year: number | null | undefined): number | null {
  return typeof year === "number" && year > 0 ? year : null;
}
