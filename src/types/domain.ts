export type MediaType = "movie" | "tv";
export type Theme = "dark" | "light";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface WatchlistEntry {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  addedAt: string;
}

export type WatchlistInput = Omit<WatchlistEntry, "addedAt">;

export interface RatingEntry {
  id: number;
  type: MediaType;
  title: string;
  userRating: number;
  review: string;
  ratedAt: string;
}

export interface WatchedEntry {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  watchedAt: string;
  runtimeMinutes?: number | null;
  platform?: string | null;
}

export type WatchedInput = Omit<WatchedEntry, "watchedAt">;

export type RatingsMap = Record<string, RatingEntry>;

export interface FilterValues {
  yearFrom: string;
  yearTo: string;
  minRating: string;
  maxRating: string;
  language: string;
  minRuntime: string;
  maxRuntime: string;
  includeAdult: boolean;
}

export type SortOption =
  | "popularity.desc"
  | "vote_average.desc"
  | "primary_release_date.desc"
  | "primary_release_date.asc"
  | "original_title.asc";

export interface Genre {
  id: number;
  name: string;
}

export interface UserList {
  id: number;
  name: string;
  description: string;
  items: WatchlistEntry[];
  createdAt: string;
}

// ─── Raw API response shapes (as returned by the Django serializers) ──────────
// These mirror backend/userdata/serializers.py field-for-field; the hooks that
// fetch them map into the frontend-normalized shapes above (id/type instead of
// mediaId/mediaType, etc).

export interface WatchlistEntryDTO {
  id: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  addedAt: string;
}

export interface WatchedEntryDTO {
  id: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  watchedAt: string;
  originalLanguage: string | null;
  releaseYear: number | null;
  runtimeMinutes?: number | null;
  platform?: string | null;
}

export interface RatingEntryDTO {
  id: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  userRating: number;
  review: string;
  ratedAt: string;
}

export interface UserListItemDTO {
  id: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  addedAt: string;
  watched: boolean;
}

export interface UserListDTO {
  id: number;
  name: string;
  description: string;
  items: UserListItemDTO[];
  createdAt: string;
}
