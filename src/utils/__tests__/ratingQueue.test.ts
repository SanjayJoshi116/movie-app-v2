import { buildRatingQueue, countUnrated, knownYear, sortByWatchedDesc } from "../ratingQueue";
import type { WatchedEntry } from "../../types";

// rating-queue: watched titles without a rating, newest watched first.

const w = (id: number, type: "movie" | "tv", watchedAt: string): WatchedEntry => ({
  id, type, title: `${type} ${id}`, posterPath: null, voteAverage: 7, watchedAt,
});

const rated = (keys: string[]) => (id: number, type: string) => keys.includes(`${type}-${id}`);

describe("sortByWatchedDesc + buildRatingQueue (the page's queue)", () => {
  const queue = (list: WatchedEntry[], keys: string[]) => buildRatingQueue(sortByWatchedDesc(list), rated(keys));

  it("keeps unrated titles, newest watched first", () => {
    const list = [w(1, "movie", "2026-01-01T10:00:00Z"), w(2, "tv", "2026-03-01T10:00:00Z"), w(3, "movie", "2026-02-01T10:00:00Z")];
    expect(queue(list, ["movie-3"]).map((e) => e.id)).toEqual([2, 1]);
  });

  it("keeps a movie and a show with the same id apart", () => {
    const list = [w(5, "movie", "2026-01-01T10:00:00Z"), w(5, "tv", "2026-01-02T10:00:00Z")];
    expect(queue(list, ["movie-5"]).map((e) => e.type)).toEqual(["tv"]);
  });

  it("breaks a tie on the watch time by id", () => {
    const t = "2026-01-01T10:00:00Z";
    expect(queue([w(1, "movie", t), w(9, "movie", t)], []).map((e) => e.id)).toEqual([9, 1]);
  });

  it("doesn't reorder the list it's given", () => {
    const list = [w(1, "movie", "2026-01-01T10:00:00Z"), w(2, "movie", "2026-02-01T10:00:00Z")];
    queue(list, []);
    expect(list.map((e) => e.id)).toEqual([1, 2]);
  });

  it("is empty for an empty history", () => {
    expect(queue([], [])).toEqual([]);
  });
});

describe("countUnrated", () => {
  it("counts titles without a rating", () => {
    const list = [w(1, "movie", "2026-01-01T10:00:00Z"), w(2, "tv", "2026-01-01T10:00:00Z")];
    expect(countUnrated(list, rated(["tv-2"]))).toBe(1);
    expect(countUnrated(list, rated(["tv-2", "movie-1"]))).toBe(0);
  });
});

describe("knownYear", () => {
  it("drops the unknown-year sentinel and missing values", () => {
    expect(knownYear(2001)).toBe(2001);
    expect(knownYear(-1)).toBeNull();
    expect(knownYear(null)).toBeNull();
    expect(knownYear(undefined)).toBeNull();
  });
});
