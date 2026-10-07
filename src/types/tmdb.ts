// ─── Shared primitives ────────────────────────────────────────────────────────

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBSpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

// ─── Paginated response wrapper ───────────────────────────────────────────────

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ─── Cast / Crew ──────────────────────────────────────────────────────────────

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department?: string;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBAggregateCastMember {
  id: number;
  name: string;
  profile_path: string | null;
  roles: Array<{ character: string; episode_count: number }>;
  total_episode_count: number;
  order: number;
}

export interface TMDBAggregateCreditsFull {
  cast: TMDBAggregateCastMember[];
  crew: TMDBCrewMember[];
}

// ─── Videos ──────────────────────────────────────────────────────────────────

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBVideoResults {
  results: TMDBVideo[];
}

// ─── Images ──────────────────────────────────────────────────────────────────

export interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
}

export interface TMDBImages {
  backdrops: TMDBImage[];
  posters: TMDBImage[];
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface TMDBReview {
  id: string;
  author: string;
  content: string;
  created_at: string;
  author_details: {
    rating: number | null;
    avatar_path: string | null;
  };
}

// ─── Watch Providers ─────────────────────────────────────────────────────────

export interface TMDBProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface TMDBProviderRegion {
  link?: string;
  flatrate?: TMDBProvider[];
  rent?: TMDBProvider[];
  buy?: TMDBProvider[];
}

export type TMDBWatchProviders = Record<string, TMDBProviderRegion>;

export interface TMDBWatchProviderResponse {
  results: TMDBWatchProviders;
}

// ─── Movie ────────────────────────────────────────────────────────────────────

export interface TMDBMovieSummary {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  release_date: string;
  genre_ids: number[];
  original_language: string;
  popularity: number;
}

export interface TMDBMovieDetail extends Omit<TMDBMovieSummary, "genre_ids"> {
  genres: TMDBGenre[];
  runtime: number | null;
  status: string;
  tagline: string | null;
  budget: number;
  revenue: number;
  production_companies: TMDBProductionCompany[];
  spoken_languages: TMDBSpokenLanguage[];
  imdb_id: string | null;
  homepage: string | null;
  // Joined by the app during fetch
  credits: TMDBCredits & { detailedCast?: TMDBPerson[] };
  videos: TMDBVideoResults;
  images: TMDBImages;
  reviews: TMDBReview[];
  similarMovies: TMDBMovieSummary[];
  watchProviders: TMDBWatchProviders;
  certifications: string;
  recommendations: TMDBMovieSummary[];
}

/** Raw `/movie/{id}` response: `append_to_response` returns recommendations paginated, before the app flattens them. */
export type TMDBMovieDetailResponse = Omit<TMDBMovieDetail, "recommendations"> & {
  recommendations?: TMDBPaginatedResponse<TMDBMovieSummary>;
};

// ─── TV Show ──────────────────────────────────────────────────────────────────

export interface TMDBTVSummary {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  genre_ids: number[];
  original_language: string;
  popularity: number;
}

export interface TMDBTVSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
}

export interface TMDBSeasonDetail {
  id: number;
  name: string;
  season_number: number;
  episodes: TMDBEpisode[];
  poster_path: string | null;
  air_date: string | null;
}

export interface TMDBNetwork {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBTVDetail extends Omit<TMDBTVSummary, "genre_ids"> {
  genres: TMDBGenre[];
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TMDBTVSeason[];
  status: string;
  tagline: string | null;
  episode_run_time: number[];
  networks: TMDBNetwork[];
  production_companies: TMDBProductionCompany[];
  spoken_languages: TMDBSpokenLanguage[];
  homepage: string | null;
  created_by?: { id: number; name: string }[];
  // Joined by the app during fetch
  credits: TMDBCredits;
  aggregateCredits: TMDBAggregateCreditsFull;
  videos: TMDBVideoResults;
  images: TMDBImages;
  reviews: TMDBReview[];
  recommendations: TMDBTVSummary[];
  watchProviders: TMDBWatchProviders;
}

// ─── Person ───────────────────────────────────────────────────────────────────

export interface TMDBPerson {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  imdb_id: string | null;
  homepage: string | null;
}

export interface TMDBPersonMovieCredit {
  id: number;
  title: string;
  character?: string;
  job?: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  media_type: "movie";
}

export interface TMDBPersonTVCredit {
  id: number;
  name: string;
  character?: string;
  job?: string;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  media_type: "tv";
}

export type TMDBPersonCombinedCredit = TMDBPersonMovieCredit | TMDBPersonTVCredit;

export interface TMDBPersonCredits {
  cast: TMDBPersonCombinedCredit[];
  crew: TMDBPersonCombinedCredit[];
}

export interface TMDBPersonImages {
  profiles: TMDBImage[];
}

export interface TMDBPersonSummary {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  known_for: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type: string;
    poster_path: string | null;
  }>;
}
