import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useWatchedContext } from "../../context/WatchedContext";
import { useRatingsContext } from "../../context/RatingsContext";
import type { RatingEntry, WatchedEntry } from "../../types";
import { RateQueuePrompt } from "../RateQueuePrompt";

// rating-queue spec: the entry points show how many watched titles are unrated.

jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: jest.fn() }));
jest.mock("../../context/RatingsContext", () => ({ useRatingsContext: jest.fn() }));

const w = (id: number): WatchedEntry => ({
  id, type: "movie", title: `T${id}`, posterPath: null, voteAverage: 7, watchedAt: "2026-01-01T12:00:00Z",
});
const r = (id: number): RatingEntry => ({ id, type: "movie", title: `T${id}`, userRating: 8, review: "", ratedAt: "" });

function setup(watched: WatchedEntry[], rated: RatingEntry[], loaded = { watched: true, ratings: true }) {
  const map = Object.fromEntries(rated.map((e) => [`movie-${e.id}`, e]));
  (useWatchedContext as jest.Mock).mockReturnValue({ watchedList: watched, hasLoaded: loaded.watched });
  (useRatingsContext as jest.Mock).mockReturnValue({
    ratings: map, get: (id: number, type: string) => map[`${type}-${id}`] ?? null, hasLoaded: loaded.ratings,
  });
}

const show = (minCount: number, variant: "watched" | "recommendations") =>
  render(<MemoryRouter><RateQueuePrompt minCount={minCount} variant={variant} /></MemoryRouter>);

it("counts unrated watched titles and links to the rate page", () => {
  setup(Array.from({ length: 12 }, (_, i) => w(i + 1)), [r(1)]);
  show(1, "watched");
  expect(screen.getByText("11 watched titles aren't rated")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Rate them" })).toHaveAttribute("href", "/watched/rate");
});

it("uses the singular for one title", () => {
  setup([w(1)], []);
  show(1, "watched");
  expect(screen.getByText("1 watched title isn't rated")).toBeInTheDocument();
});

it("is hidden when every watched title is rated", () => {
  setup([w(1), w(2)], [r(1), r(2)]);
  show(1, "watched");
  expect(screen.queryByRole("link", { name: "Rate them" })).toBeNull();
});

it("waits until both the history and the ratings have loaded", () => {
  setup([w(1), w(2), w(3)], [], { watched: true, ratings: false });
  show(1, "watched");
  expect(screen.queryByRole("link", { name: "Rate them" })).toBeNull();
});

it("on Recommendations shows only from three unrated titles", () => {
  setup([w(1), w(2)], []);
  const { unmount } = show(3, "recommendations");
  expect(screen.queryByRole("link", { name: "Rate them" })).toBeNull();
  unmount();
  setup([w(1), w(2), w(3)], []);
  show(3, "recommendations");
  expect(screen.getByText(/Rate what you've watched to improve these/)).toBeInTheDocument();
});
