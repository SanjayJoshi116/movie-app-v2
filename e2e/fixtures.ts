import { test as base, expect, type Page } from "@playwright/test";
import type { AuthUser } from "../src/types/domain";

/**
 * Shared e2e fixtures. Specs import `test`/`expect` from here, not from
 * "@playwright/test", so every test gets the `unmocked` catch-all.
 *
 * Playwright checks routes last-registered-first. The catch-all is registered
 * before the test body runs, so any `page.route()` a test or `mockAuthedBase`
 * adds wins over it.
 */

// `satisfies` the app's own API types, so a renamed or missing field is a
// type error (npm run typecheck covers e2e/) instead of a silently wrong mock.
export const MOCK_USER = {
  id: 1, username: "testuser", email: "t@t.com", first_name: "", last_name: "",
  is_staff: false, avatar_url: null,
} satisfies AuthUser;
const MOCK_TOKENS = { access: "fake-access", refresh: "fake-refresh" };

const EMPTY_TMDB_PAGE = { results: [], total_pages: 1, total_results: 0, page: 1 };

/** The real list-endpoint response shape (DRF pagination), not a bare array.
 *  One page by default; pass `next` (and the total `count`) to serve a page of
 *  a longer list. */
export function paginated<T>(
  items: T[],
  { next = null, count = items.length }: { next?: string | null; count?: number } = {},
) {
  return { count, next, previous: null, results: items };
}

export const test = base.extend<{ unmocked: string[] }>({
  unmocked: [
    async ({ page }, use) => {
      const urls: string[] = [];
      await page.route("**/api/**", (route) => {
        const url = route.request().url();
        // Decorative TMDB calls (hero banner, providers...) get an empty page
        // rather than failing every test that doesn't care about them.
        if (url.includes("/api/tmdb/")) return route.fulfill({ json: EMPTY_TMDB_PAGE });
        urls.push(`${route.request().method()} ${url}`);
        return route.fulfill({ status: 501, json: { detail: `unmocked: ${url}` } });
      });
      await use(urls);
      expect(urls, `Unmocked app API calls (add a page.route for each):\n${urls.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Seed a signed-in session in localStorage before the app boots. */
export async function seedAuth(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
  }, { ...MOCK_TOKENS, user: MOCK_USER });
}

/**
 * Every API call the app makes on any authenticated page. Trailing `**`
 * matters: fetchAllPages() always appends `?page=N`.
 */
export async function mockAppApi(page: Page) {
  for (const path of ["watchlist", "watched", "ratings", "lists", "followed-people"]) {
    await page.route(`**/api/${path}/**`, (route) => route.fulfill({ json: paginated([]) }));
  }
  await page.route("**/api/notifications/new-releases/**", (route) =>
    route.fulfill({ json: { items: [], unreadCount: 0 } })
  );
  await page.route("**/api/notifications/mark-seen/**", (route) => route.fulfill({ status: 204, body: "" }));
}

/** Signed-in session plus `mockAppApi`. */
export async function mockAuthedBase(page: Page) {
  await seedAuth(page);
  await mockAppApi(page);
}

/** A movie detail response with every append_to_response part present. */
export function movieDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 100, title: "Movie 1", overview: "Test", release_date: "2024-01-01",
    poster_path: null, backdrop_path: null, genres: [], runtime: 120,
    vote_average: 7.5, vote_count: 200, status: "Released",
    original_language: "en", budget: 0, revenue: 0,
    credits: { cast: [], crew: [] }, images: { backdrops: [] },
    videos: { results: [] }, recommendations: { results: [] },
    reviews: { results: [], total_pages: 1 },
    similar: { results: [], total_pages: 1 },
    "watch/providers": { results: {} },
    release_dates: { results: [] },
    ...overrides,
  };
}

/** A TV detail response with every append_to_response part present. */
export function tvDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 200, name: "Show 1", overview: "Test", first_air_date: "2020-01-01",
    poster_path: null, backdrop_path: null, genres: [], episode_run_time: [],
    number_of_seasons: 2, number_of_episodes: 20, seasons: [], networks: [],
    vote_average: 7.5, vote_count: 200, status: "Returning Series",
    original_language: "en", created_by: [],
    external_ids: {}, aggregate_credits: { cast: [], crew: [] }, images: { backdrops: [] },
    videos: { results: [] }, recommendations: { results: [] },
    reviews: { results: [], total_pages: 1 },
    similar: { results: [], total_pages: 1 },
    "watch/providers": { results: {} },
    ...overrides,
  };
}
