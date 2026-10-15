import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import type {
  TMDBPaginatedResponse,
  TMDBMovieSummary,
  TMDBMovieDetailResponse,
  TMDBTVSummary,
  TMDBTVDetailResponse,
  TMDBSeasonDetail,
  TMDBPerson,
  TMDBPersonCredits,
  TMDBPersonImages,
  TMDBPersonSummary,
  FilterValues,
  SortOption,
} from "../types";
import {
  NEWEST_SORT_MIN_VOTES, OLDEST_SORT_MIN_VOTES, RATING_SORT_MIN_VOTES, TITLE_SORT_MIN_VOTES,
} from "../constants/discover";
import { todayLocalISO } from "../utils/browseFilters";

// Same-origin by default (see DJANGO_BASE in userApi.ts).
const api = axios.create({ baseURL: process.env.REACT_APP_TMDB_BASE_URL || "/api/tmdb" });

/** Exported for tests only. */
export { api as tmdbApi };

declare module "axios" {
  interface InternalAxiosRequestConfig {
    /** Set on the one retry after a 401: the request goes out without a token. */
    _noAuthRetry?: boolean;
  }
}

// Send the signed-in user's token so the proxy throttles per user, not per IP
// (users behind one NAT shared a bucket). The proxy itself is public.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cinedb_access");
  if (token && !config._noAuthRetry) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // DRF answers an expired/invalid token with 401 even on this AllowAny
    // view. This is public data, so retry once without the token. Never log
    // out or refresh here: token refresh lives only in userApi's interceptor,
    // and the next userApi call refreshes the token anyway.
    if (error.response?.status === 401 && original && !original._noAuthRetry) {
      original._noAuthRetry = true;
      delete original.headers.Authorization;
      return api(original);
    }
    // Retry once on 500 after a brief pause — handles transient proxy/network
    // blips, matching the retry behavior in src/api/userApi.ts.
    if (error.response?.status === 500 && original && !original._retry500) {
      original._retry500 = true;
      await new Promise((r) => setTimeout(r, 2000));
      return api(original);
    }
    return Promise.reject(error);
  }
);

// Identical GETs still in flight share one request: the dev build mounts every
// component twice, and two components can ask for the same data at once. Only
// in-flight requests are shared; a later call fetches again (the proxy caches).
const inflight = new Map<string, Promise<AxiosResponse>>();

function sharedGet<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  const key = api.getUri({ url, params: config?.params });
  let pending = inflight.get(key);
  if (!pending) {
    pending = api.get(url, config).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending as Promise<AxiosResponse<T>>;
}

// ─── Movies ───────────────────────────────────────────────────────────────────

export const discoverMovies = (
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  sharedGet("/discover/movie", { params });

export const fetchMoviesByCategory = (
  category: string,
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  sharedGet(`/movie/${category}`, { params });

export const searchMovies = (
  query: string,
  page = 1,
  includeAdult = false,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  sharedGet("/search/movie", { params: { query, page, include_adult: includeAdult } });

/** Everything the movie detail page shows, in one request (TMDB allows 20 parts). */
export const fetchMovieDetails = (
  id: number | string,
): Promise<AxiosResponse<TMDBMovieDetailResponse>> =>
  sharedGet(`/movie/${id}`, {
    params: {
      append_to_response:
        "credits,images,videos,recommendations,reviews,similar,watch/providers,release_dates",
    },
  });

export const fetchMoviePoster = (
  id: number | string,
): Promise<AxiosResponse<{ poster_path: string | null; vote_average: number }>> =>
  sharedGet(`/movie/${id}`);

export const fetchTVPoster = (
  id: number | string,
): Promise<AxiosResponse<{ poster_path: string | null; vote_average: number }>> =>
  sharedGet(`/tv/${id}`);

// ─── TV Shows ─────────────────────────────────────────────────────────────────

export const discoverTV = (
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  sharedGet("/discover/tv", { params });

export const fetchTVByCategory = (
  category: string,
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  sharedGet(`/tv/${category}`, { params });

export const searchTV = (
  query: string,
  page = 1,
  includeAdult = false,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  sharedGet("/search/tv", { params: { query, page, include_adult: includeAdult } });

export const fetchTVDetails = (
  id: number | string,
): Promise<AxiosResponse<TMDBTVDetailResponse>> =>
  sharedGet(`/tv/${id}`, {
    // Everything the TV detail page shows, in one request (TMDB allows 20 parts).
    params: {
      append_to_response:
        "external_ids,similar,recommendations,videos,aggregate_credits,images,reviews,watch/providers",
    },
  });

export const fetchTVSeason = (
  tvId: number | string,
  seasonNumber: number,
): Promise<AxiosResponse<TMDBSeasonDetail>> =>
  sharedGet(`/tv/${tvId}/season/${seasonNumber}`);

// ─── People ───────────────────────────────────────────────────────────────────

export const fetchPerson = (
  id: number | string,
): Promise<AxiosResponse<TMDBPerson>> => sharedGet(`/person/${id}`);

export const fetchPersonCombinedCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonCredits>> =>
  sharedGet(`/person/${id}/combined_credits`);

export const fetchPersonMovieCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonCredits>> =>
  sharedGet(`/person/${id}/movie_credits`);

export const fetchPersonTVCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonCredits>> =>
  sharedGet(`/person/${id}/tv_credits`);

export const fetchPersonImages = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonImages>> => sharedGet(`/person/${id}/images`);

export const fetchPopularPeople = (
  page = 1,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBPersonSummary>>> =>
  sharedGet("/person/popular", { params: { page } });

export const searchPeople = (
  query: string,
  page = 1,
  includeAdult = false,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBPersonSummary>>> =>
  sharedGet("/search/person", { params: { query, page, include_adult: includeAdult } });

// ─── Genres ───────────────────────────────────────────────────────────────────

export const fetchMovieGenres = (): Promise<AxiosResponse<{ genres: Array<{ id: number; name: string }> }>> =>
  sharedGet("/genre/movie/list");

export const fetchTVGenres = (): Promise<AxiosResponse<{ genres: Array<{ id: number; name: string }> }>> =>
  sharedGet("/genre/tv/list");

// ─── Regions ──────────────────────────────────────────────────────────────────

/** Countries TMDB has watch-provider data for (the region setting's options). */
export const fetchProviderRegions = (): Promise<AxiosResponse<{
  results: Array<{ iso_3166_1: string; english_name: string; native_name?: string }>;
}>> => sharedGet("/watch/providers/regions");

// ─── Trending ─────────────────────────────────────────────────────────────────

export const fetchTrending = (
  mediaType: "movie" | "tv" | "all" = "movie",
  timeWindow: "day" | "week" = "week",
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  sharedGet(`/trending/${mediaType}/${timeWindow}`);

// ─── Filter helpers ────────────────────────────────────────────────────────────

export function filtersToTMDBParams(
  filters: Partial<FilterValues> = {},
  sortBy: SortOption = "popularity.desc",
  mediaType: "movie" | "tv" = "movie",
): Record<string, string | number> {
  const isTV = mediaType === "tv";
  const dateField = isTV ? "first_air_date" : "primary_release_date";
  // TV discover has no primary_release_date/original_title sort fields.
  let effectiveSortBy: string = sortBy;
  if (isTV && sortBy.startsWith("primary_release_date")) {
    effectiveSortBy = sortBy.replace("primary_release_date", "first_air_date");
  } else if (isTV && sortBy === "original_title.asc") {
    effectiveSortBy = "original_name.asc";
  }
  const params: Record<string, string | number> = { sort_by: effectiveSortBy };
  if (filters.yearFrom) params[`${dateField}.gte`] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params[`${dateField}.lte`] = `${filters.yearTo}-12-31`;
  // Floors (constants/discover.ts): without them these sorts lead with junk.
  if (sortBy === "vote_average.desc") {
    params["vote_count.gte"] = RATING_SORT_MIN_VOTES;
  } else if (sortBy === "primary_release_date.desc") {
    params["vote_count.gte"] = NEWEST_SORT_MIN_VOTES;
    // Nothing dated after the device's today (placeholders years ahead).
    const today = todayLocalISO();
    const lte = params[`${dateField}.lte`];
    if (typeof lte !== "string" || lte > today) params[`${dateField}.lte`] = today;
  } else if (sortBy === "primary_release_date.asc") {
    params["vote_count.gte"] = OLDEST_SORT_MIN_VOTES;
  } else if (sortBy === "original_title.asc") {
    params["vote_count.gte"] = TITLE_SORT_MIN_VOTES;
  }
  if (filters.minRating) params["vote_average.gte"] = filters.minRating;
  if (filters.maxRating) params["vote_average.lte"] = filters.maxRating;
  if (filters.language) params["with_original_language"] = filters.language;
  // The panel only shows runtime for movies; never let a stale value reach TV.
  if (!isTV && filters.minRuntime) params["with_runtime.gte"] = filters.minRuntime;
  if (!isTV && filters.maxRuntime) params["with_runtime.lte"] = filters.maxRuntime;
  if (filters.includeAdult) params["include_adult"] = "true";
  return params;
}
