import type { FilterValues, SortOption } from "../types";
import { movieGenres, tvGenres } from "../constants/genres";

export const DEFAULT_SORT: SortOption = "popularity.desc";

const VALUE_FIELDS: (keyof FilterValues)[] = [
  "yearFrom", "yearTo", "minRating", "maxRating", "language", "minRuntime", "maxRuntime",
];

/**
 * Whether a browse grid should use discover with the user's filters instead
 * of the selected category. `includeAdult` is deliberately ignored: it's a
 * boolean (so `!== ""` was always true) and on its own it isn't a filter the
 * category buttons should yield to.
 */
export function hasActiveFilters(
  filters: FilterValues | null,
  sortBy: SortOption,
  genres: number[],
): boolean {
  if (genres.length > 0) return true;
  if (sortBy !== DEFAULT_SORT) return true;
  if (!filters) return false;
  return VALUE_FIELDS.some((k) => filters[k] !== "");
}

/** Today's date in the browser's local timezone as yyyy-mm-dd (not UTC). */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Keep only genre ids that exist for this media type. Selected genres are
 * cleared when the browse media type changes, but that happens in an effect,
 * after the newly mounted page's first fetch — this guard means that fetch
 * can never carry another media type's genre id.
 */
export function genresFor(mediaType: "movie" | "tv", ids: number[]): number[] {
  const valid = mediaType === "movie" ? movieGenres : tvGenres;
  return ids.filter((id) => valid.some((g) => g.id === id));
}

export type BrowseScope = "movie" | "tv" | "anime-tv" | "anime-movies";

/** Which browse grid (and so which filter set) a route shows; null off browse pages. */
export function browseScope(pathname: string, animeMediaType: "tv" | "movies"): BrowseScope | null {
  if (pathname === "/movies") return "movie";
  if (pathname === "/tv") return "tv";
  if (pathname === "/anime") return animeMediaType === "movies" ? "anime-movies" : "anime-tv";
  return null;
}
