import axios, { AxiosResponse } from "axios";
import type {
  TMDBPaginatedResponse,
  TMDBMovieSummary,
  TMDBMovieDetail,
  TMDBTVSummary,
  TMDBTVDetail,
  TMDBSeasonDetail,
  TMDBCredits,
  TMDBAggregateCreditsFull,
  TMDBImages,
  TMDBVideoResults,
  TMDBPerson,
  TMDBPersonCredits,
  TMDBPersonImages,
  TMDBPersonSummary,
  TMDBWatchProviderResponse,
  FilterValues,
  SortOption,
} from "../types";

const api = axios.create({ baseURL: process.env.REACT_APP_TMDB_BASE_URL || `http://${window.location.hostname}:3001/api/tmdb` });

// ─── Movies ───────────────────────────────────────────────────────────────────

export const discoverMovies = (
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  api.get("/discover/movie", { params });

export const fetchMoviesByCategory = (
  category: string,
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  api.get(`/movie/${category}`, { params });

export const searchMovies = (
  query: string,
  page = 1,
  includeAdult = false,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  api.get("/search/movie", { params: { query, page, include_adult: includeAdult } });

export const fetchMovieDetails = (
  id: number | string,
): Promise<AxiosResponse<TMDBMovieDetail>> =>
  api.get(`/movie/${id}`, {
    params: { append_to_response: "credits,images,videos,recommendations" },
  });

export const fetchMoviePoster = (
  id: number | string,
): Promise<AxiosResponse<{ poster_path: string | null; vote_average: number }>> =>
  api.get(`/movie/${id}`);

export const fetchTVPoster = (
  id: number | string,
): Promise<AxiosResponse<{ poster_path: string | null; vote_average: number }>> =>
  api.get(`/tv/${id}`);

export const fetchMovieReviews = (
  id: number | string,
  page = 1,
): Promise<
  AxiosResponse<
    TMDBPaginatedResponse<{
      id: string;
      author: string;
      content: string;
      created_at: string;
      author_details: { rating: number | null; avatar_path: string | null };
    }>
  >
> => api.get(`/movie/${id}/reviews`, { params: { page } });

export const fetchSimilarMovies = (
  id: number | string,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  api.get(`/movie/${id}/similar`);

export const fetchMovieProviders = (
  id: number | string,
): Promise<AxiosResponse<TMDBWatchProviderResponse>> =>
  api.get(`/movie/${id}/watch/providers`);

export const fetchMovieReleaseDates = (
  id: number | string,
): Promise<
  AxiosResponse<{
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification: string; type: number }>;
    }>;
  }>
> => api.get(`/movie/${id}/release_dates`);

// ─── TV Shows ─────────────────────────────────────────────────────────────────

export const discoverTV = (
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  api.get("/discover/tv", { params });

export const fetchTVByCategory = (
  category: string,
  params: Record<string, string | number> = {},
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  api.get(`/tv/${category}`, { params });

export const searchTV = (
  query: string,
  page = 1,
  includeAdult = false,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  api.get("/search/tv", { params: { query, page, include_adult: includeAdult } });

export const fetchTVDetails = (
  id: number | string,
): Promise<AxiosResponse<TMDBTVDetail>> =>
  api.get(`/tv/${id}`, {
    params: { append_to_response: "external_ids,similar,recommendations" },
  });

export const fetchTVCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBCredits>> => api.get(`/tv/${id}/credits`);

export const fetchTVAggregateCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBAggregateCreditsFull>> =>
  api.get(`/tv/${id}/aggregate_credits`);

export const fetchTVImages = (
  id: number | string,
): Promise<AxiosResponse<TMDBImages>> => api.get(`/tv/${id}/images`);

export const fetchTVRecommendations = (
  id: number | string,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBTVSummary>>> =>
  api.get(`/tv/${id}/recommendations`);

export const fetchTVContentRatings = (
  id: number | string,
): Promise<
  AxiosResponse<{ results: Array<{ iso_3166_1: string; rating: string }> }>
> => api.get(`/tv/${id}/content_ratings`);

export const fetchTVVideos = (
  id: number | string,
): Promise<AxiosResponse<TMDBVideoResults>> => api.get(`/tv/${id}/videos`);

export const fetchTVWatchProviders = (
  id: number | string,
): Promise<AxiosResponse<TMDBWatchProviderResponse>> =>
  api.get(`/tv/${id}/watch/providers`);

export const fetchTVSeason = (
  tvId: number | string,
  seasonNumber: number,
): Promise<AxiosResponse<TMDBSeasonDetail>> =>
  api.get(`/tv/${tvId}/season/${seasonNumber}`);

// ─── People ───────────────────────────────────────────────────────────────────

export const fetchPerson = (
  id: number | string,
): Promise<AxiosResponse<TMDBPerson>> => api.get(`/person/${id}`);

export const fetchPersonCombinedCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonCredits>> =>
  api.get(`/person/${id}/combined_credits`);

export const fetchPersonMovieCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonCredits>> =>
  api.get(`/person/${id}/movie_credits`);

export const fetchPersonTVCredits = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonCredits>> =>
  api.get(`/person/${id}/tv_credits`);

export const fetchPersonImages = (
  id: number | string,
): Promise<AxiosResponse<TMDBPersonImages>> => api.get(`/person/${id}/images`);

export const fetchPopularPeople = (
  page = 1,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBPersonSummary>>> =>
  api.get("/person/popular", { params: { page } });

export const searchPeople = (
  query: string,
  page = 1,
  includeAdult = false,
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBPersonSummary>>> =>
  api.get("/search/person", { params: { query, page, include_adult: includeAdult } });

// ─── Genres ───────────────────────────────────────────────────────────────────

export const fetchMovieGenres = (): Promise<AxiosResponse<{ genres: Array<{ id: number; name: string }> }>> =>
  api.get("/genre/movie/list");

export const fetchTVGenres = (): Promise<AxiosResponse<{ genres: Array<{ id: number; name: string }> }>> =>
  api.get("/genre/tv/list");

// ─── Trending ─────────────────────────────────────────────────────────────────

export const fetchTrending = (
  mediaType: "movie" | "tv" | "all" = "movie",
  timeWindow: "day" | "week" = "week",
): Promise<AxiosResponse<TMDBPaginatedResponse<TMDBMovieSummary>>> =>
  api.get(`/trending/${mediaType}/${timeWindow}`);

// ─── Filter helpers ────────────────────────────────────────────────────────────

export function filtersToTMDBParams(
  filters: Partial<FilterValues> = {},
  sortBy: SortOption = "popularity.desc",
  mediaType: "movie" | "tv" = "movie",
): Record<string, string | number> {
  const isTV = mediaType === "tv";
  const dateField = isTV ? "first_air_date" : "primary_release_date";
  const effectiveSortBy = isTV && sortBy.startsWith("primary_release_date")
    ? sortBy.replace("primary_release_date", "first_air_date")
    : sortBy;
  const params: Record<string, string | number> = { sort_by: effectiveSortBy };
  if (filters.yearFrom) params[`${dateField}.gte`] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params[`${dateField}.lte`] = `${filters.yearTo}-12-31`;
  if (filters.minRating) params["vote_average.gte"] = filters.minRating;
  if (filters.maxRating) params["vote_average.lte"] = filters.maxRating;
  if (filters.language) params["with_original_language"] = filters.language;
  if (filters.minRuntime) params["with_runtime.gte"] = filters.minRuntime;
  if (filters.maxRuntime) params["with_runtime.lte"] = filters.maxRuntime;
  if (filters.includeAdult) params["include_adult"] = "true";
  return params;
}
