import { readFile } from "node:fs/promises";
import { test, expect, mockAuthedBase } from "./fixtures";
import type { TMDBMovieSummary, TMDBTVSummary } from "../src/types/tmdb";

// release-calendar / calendar-export specs: the window's most popular releases,
// and an iCal export that holds only what the title filter shows.

// Two days out stays inside the Calendar's window whatever the runner's zone.
const releaseDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const movie = (id: number, title: string) => ({
  id, title, overview: "", poster_path: null, backdrop_path: null, release_date: releaseDate,
  vote_average: 7, vote_count: 10, genre_ids: [18], popularity: 50, original_language: "en",
}) satisfies TMDBMovieSummary;

const SHOW = {
  id: 77, name: "Batman Show", overview: "", poster_path: null, backdrop_path: null, first_air_date: releaseDate,
  vote_average: 7, vote_count: 10, genre_ids: [18], popularity: 40, original_language: "en",
} satisfies TMDBTVSummary;

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

test("asks for the window's most popular releases and says so", async ({ page }) => {
  const sorts: Record<string, string | null> = {};
  for (const type of ["movie", "tv"] as const) {
    await page.route(`**/api/tmdb/discover/${type}**`, (route) => {
      sorts[type] = new URL(route.request().url()).searchParams.get("sort_by");
      const results = type === "movie" ? [movie(1, "Some Film")] : [SHOW];
      return route.fulfill({ json: { results, page: 1, total_pages: 1, total_results: 1 } });
    });
  }
  await page.goto("/calendar");
  await expect(page.getByText("Some Film")).toBeVisible();
  expect(sorts).toEqual({ movie: "popularity.desc", tv: "popularity.desc" });
  await expect(page.getByText("The most popular releases in the next 7 days")).toBeVisible();
});

test("iCal export holds only the releases the title filter shows", async ({ page }) => {
  await page.route("**/api/tmdb/discover/movie**", (route) =>
    route.fulfill({
      json: { results: [movie(1, "Batman Returns Again"), movie(2, "Quiet Drama")], page: 1, total_pages: 1, total_results: 2 },
    })
  );
  await page.route("**/api/tmdb/discover/tv**", (route) =>
    route.fulfill({ json: { results: [SHOW], page: 1, total_pages: 1, total_results: 1 } })
  );
  await page.goto("/calendar");
  await expect(page.getByText("Quiet Drama")).toBeVisible();

  await page.locator("#calendar-search").fill("batman");
  await expect(page.getByText("Quiet Drama")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export iCal" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const ics = await readFile(path, "utf-8");
  expect(ics).toContain("Batman Returns Again");
  expect(ics).toContain("Batman Show");
  expect(ics).not.toContain("Quiet Drama");
});
