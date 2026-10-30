import type { TMDBMovieSummary, TMDBTVSummary } from "../../types";
import { toMediaSummary } from "../mediaSummary";

const common = {
  backdrop_path: null, overview: "", vote_count: 10, genre_ids: [18],
  original_language: "en", popularity: 1,
};

const MOVIE = { ...common, id: 550, title: "Fight Club", poster_path: "/fc.jpg", vote_average: 8.4, release_date: "1999-10-15" } satisfies TMDBMovieSummary;
const SHOW = { ...common, id: 1396, name: "Breaking Bad", poster_path: null, vote_average: 8.9, first_air_date: "2008-01-20" } satisfies TMDBTVSummary;

it("maps a movie's title", () => {
  expect(toMediaSummary(MOVIE, "movie")).toEqual({
    id: 550, type: "movie", title: "Fight Club", posterPath: "/fc.jpg", voteAverage: 8.4,
  });
});

it("maps a TV show's name and keeps a null poster", () => {
  expect(toMediaSummary(SHOW, "tv")).toEqual({
    id: 1396, type: "tv", title: "Breaking Bad", posterPath: null, voteAverage: 8.9,
  });
});
