import { hasActiveFilters, todayLocalISO } from "../browseFilters";
import { filtersToTMDBParams } from "../../api/tmdb";
import type { FilterValues } from "../../types";

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
