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

/**
 * Keep only genre ids that exist for this media type. Genre picks live in
 * UIContext, a parent provider App can't update during its render, so they're
 * cleared in an effect after a scope change (applied filters reset during
 * render). Until then this guard keeps the new scope's first fetch from
 * carrying another media type's genre id.
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

/** The Anime mode a saved Anime category belongs to (`anime-movies-*` or `anime-tv-*`). */
export function animeModeOf(category: string): "tv" | "movies" {
  return category.startsWith("anime-movies-") ? "movies" : "tv";
}
