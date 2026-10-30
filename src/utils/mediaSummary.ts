import type { MediaType, TMDBMovieSummary, TMDBTVSummary } from "../types";

// What a browse/search card needs from a TMDB list item. TMDB names the title
// `title` for movies and `name` for TV; the caller states the type (it knows
// which endpoint it fetched from), so nothing is guessed from the shape.
export interface MediaSummary {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
}

export function toMediaSummary(item: TMDBMovieSummary, type: "movie"): MediaSummary;
export function toMediaSummary(item: TMDBTVSummary, type: "tv"): MediaSummary;
export function toMediaSummary(item: TMDBMovieSummary | TMDBTVSummary, type: MediaType): MediaSummary {
  return {
    id: item.id,
    type,
    title: type === "movie" ? (item as TMDBMovieSummary).title : (item as TMDBTVSummary).name,
    posterPath: item.poster_path,
    voteAverage: item.vote_average,
  };
}
