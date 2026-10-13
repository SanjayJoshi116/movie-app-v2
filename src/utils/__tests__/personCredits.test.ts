import { byDateDesc, mergeCredits, mergeCrew, sortCreditsNewestFirst } from "../personCredits";
import type { TMDBPersonCombinedCredit } from "../../types";

const movie = (id: number, release_date: string, extra: Partial<TMDBPersonCombinedCredit> = {}) =>
  ({ id, title: `Movie ${id}`, poster_path: null, release_date, vote_average: 7, media_type: "movie", ...extra }) as TMDBPersonCombinedCredit;
const show = (id: number, first_air_date: string, extra: Partial<TMDBPersonCombinedCredit> = {}) =>
  ({ id, name: `Show ${id}`, poster_path: null, first_air_date, vote_average: 7, media_type: "tv", ...extra }) as TMDBPersonCombinedCredit;

describe("byDateDesc", () => {
  it("orders newest first with undated last", () => {
    expect(["1999-10-15", "", "2019-05-30"].sort(byDateDesc)).toEqual(["2019-05-30", "1999-10-15", ""]);
  });
});

describe("sortCreditsNewestFirst", () => {
  it("sorts movie and TV dates alike", () => {
    const sorted = sortCreditsNewestFirst([movie(1, "1999-01-01"), movie(2, ""), movie(3, "2019-01-01")]);
    expect(sorted.map((c) => c.id)).toEqual([3, 1, 2]);
  });
});

describe("mergeCredits", () => {
  it("joins two roles on one title", () => {
    const merged = mergeCredits([movie(1, "2000-01-01", { character: "A" }), movie(1, "2000-01-01", { character: "B" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.character).toBe("A / B");
  });
});

describe("mergeCrew", () => {
  it("gives one card per title with its jobs joined", () => {
    const crew = mergeCrew(
      [movie(1, "2019-01-01", { job: "Director" }), movie(1, "2019-01-01", { job: "Writer" }), movie(1, "2019-01-01", { job: "Director" })],
      [],
    );
    expect(crew).toEqual([expect.objectContaining({ id: 1, mediaType: "movie", name: "Movie 1", subtitle: "Director, Writer" })]);
  });

  it("keeps a movie and a show with the same id apart, newest first", () => {
    const crew = mergeCrew([movie(5, "2001-01-01", { job: "Director" })], [show(5, "2010-01-01", { job: "Creator" })]);
    expect(crew.map((c) => `${c.mediaType}-${c.id}`)).toEqual(["tv-5", "movie-5"]);
  });

  it("tolerates a missing job", () => {
    expect(mergeCrew([movie(1, "")], [])[0]?.subtitle).toBeUndefined();
  });
});
