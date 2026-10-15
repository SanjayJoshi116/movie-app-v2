import { hasActiveFilters, todayLocalISO } from "../browseFilters";
import { filtersToTMDBParams } from "../../api/tmdb";
import type { FilterValues } from "../../types";
import {
  NEWEST_SORT_MIN_VOTES, OLDEST_SORT_MIN_VOTES, RATING_SORT_MIN_VOTES, TITLE_SORT_MIN_VOTES,
} from "../../constants/discover";

const EMPTY: FilterValues = {
  yearFrom: "", yearTo: "", minRating: "", maxRating: "",
  language: "", minRuntime: "", maxRuntime: "", includeAdult: false,
};

describe("hasActiveFilters", () => {
  it("is false with no filters, default sort and no genres", () => {
    expect(hasActiveFilters(null, "popularity.desc", [])).toBe(false);
    expect(hasActiveFilters(EMPTY, "popularity.desc", [])).toBe(false);
  });

  it("ignores includeAdult on its own", () => {
    expect(hasActiveFilters({ ...EMPTY, includeAdult: true }, "popularity.desc", [])).toBe(false);
  });

  it("is true when a value field is set", () => {
    expect(hasActiveFilters({ ...EMPTY, yearFrom: "2010" }, "popularity.desc", [])).toBe(true);
  });

  it("is true for a non-default sort", () => {
    expect(hasActiveFilters(EMPTY, "vote_average.desc", [])).toBe(true);
  });

  it("is true when a genre is selected", () => {
    expect(hasActiveFilters(null, "popularity.desc", [28])).toBe(true);
  });
});

describe("todayLocalISO", () => {
  it("formats the local calendar date, not UTC", () => {
    expect(todayLocalISO(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("filtersToTMDBParams", () => {
  it("maps the title sort to TV's field", () => {
    expect(filtersToTMDBParams(EMPTY, "original_title.asc", "tv").sort_by).toBe("original_name.asc");
  });

  it("maps release-date sorts to first_air_date for TV", () => {
    expect(filtersToTMDBParams(EMPTY, "primary_release_date.desc", "tv").sort_by).toBe("first_air_date.desc");
  });

  it("drops runtime for TV", () => {
    const p = filtersToTMDBParams({ ...EMPTY, minRuntime: "90", maxRuntime: "120" }, "popularity.desc", "tv");
    expect(p).not.toHaveProperty("with_runtime.gte");
    expect(p).not.toHaveProperty("with_runtime.lte");
  });

  it("leaves movie params unchanged", () => {
    const p = filtersToTMDBParams({ ...EMPTY, minRuntime: "90" }, "original_title.asc", "movie");
    expect(p.sort_by).toBe("original_title.asc");
    expect(p["with_runtime.gte"]).toBe("90");
  });
});

describe("filtersToTMDBParams sort floors", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 15, 12, 0));
  });
  afterEach(() => jest.useRealTimers());

  it.each(["movie", "tv"] as const)("rating sort needs the rating floor (%s)", (type) => {
    expect(filtersToTMDBParams(EMPTY, "vote_average.desc", type)["vote_count.gte"]).toBe(RATING_SORT_MIN_VOTES);
  });

  it.each([
    ["movie", "primary_release_date.lte"],
    ["tv", "first_air_date.lte"],
  ] as const)("newest sort stops at today and needs a few votes (%s)", (type, field) => {
    const p = filtersToTMDBParams(EMPTY, "primary_release_date.desc", type);
    expect(p[field]).toBe("2026-10-15");
    expect(p["vote_count.gte"]).toBe(NEWEST_SORT_MIN_VOTES);
  });

  it("newest keeps an earlier year-to bound", () => {
    const p = filtersToTMDBParams({ ...EMPTY, yearFrom: "1990", yearTo: "1999" }, "primary_release_date.desc", "movie");
    expect(p["primary_release_date.gte"]).toBe("1990-01-01");
    expect(p["primary_release_date.lte"]).toBe("1999-12-31");
  });

  it("newest caps a year-to bound in the future at today", () => {
    const p = filtersToTMDBParams({ ...EMPTY, yearTo: "2030" }, "primary_release_date.desc", "movie");
    expect(p["primary_release_date.lte"]).toBe("2026-10-15");
  });

  it("oldest and title sorts need their floors", () => {
    expect(filtersToTMDBParams(EMPTY, "primary_release_date.asc", "tv")["vote_count.gte"]).toBe(OLDEST_SORT_MIN_VOTES);
    expect(filtersToTMDBParams(EMPTY, "original_title.asc", "movie")["vote_count.gte"]).toBe(TITLE_SORT_MIN_VOTES);
  });

  it("popularity is unchanged", () => {
    const p = filtersToTMDBParams(EMPTY, "popularity.desc", "movie");
    expect(p).toEqual({ sort_by: "popularity.desc" });
  });
});
