export type MediaType = "movie" | "tv";
export type Theme = "dark" | "light";

export interface WatchlistEntry {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  addedAt: string;
  watched: boolean;
}

export type WatchlistInput = Omit<WatchlistEntry, "addedAt" | "watched">;

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
