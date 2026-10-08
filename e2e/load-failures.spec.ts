import type { Page, Route } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { FollowedPersonEntry } from "../src/api/userApi";

// load-states spec: a failed load shows an error with Retry, never the empty
// state, and Retry really refetches.

const GRETA = { id: 1, personId: 7, name: "Greta Gerwig", profilePath: null } satisfies FollowedPersonEntry;

/** A route that fails until `heal()` is called, counting hits. */
function flaky(ok: (route: Route) => Promise<void>) {
  const state = { failing: true, hits: 0 };
  const handler = (route: Route) => {
    state.hits += 1;
    return state.failing ? route.fulfill({ status: 500, json: {} }) : ok(route);
  };
  return { handler, state, heal: () => { state.failing = false; } };
}

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

test("Following: a failed load shows an error with Retry, not 'not following anyone'", async ({ page }) => {
  const people = flaky((r) => r.fulfill({ json: paginated([GRETA]) }));
  await page.route("**/api/followed-people/**", people.handler);
  await page.route("**/api/recommendations/followed-people/**", (r) => r.fulfill({ json: [] }));
  await page.goto("/following");

  await expect(page.getByText("Couldn't load who you follow")).toBeVisible();
  await expect(page.getByText("You're not following anyone yet", { exact: false })).toHaveCount(0);

  people.heal();
  const before = people.state.hits;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Following (1)" })).toBeVisible();
  expect(people.state.hits).toBeGreaterThan(before); // Retry really refetched
});

test("Following: failed recommendations show an error line with Retry", async ({ page }) => {
  await page.route("**/api/followed-people/**", (r) => r.fulfill({ json: paginated([GRETA]) }));
  const recs = flaky((r) =>
    r.fulfill({ json: [{ key: "greta", label: "From Greta Gerwig", items: [] }] })
  );
  await page.route("**/api/recommendations/followed-people/**", recs.handler);
  await page.goto("/following");

  await expect(page.getByText("Couldn't load recommendations from people you follow.")).toBeVisible();
  recs.heal();
  const before = recs.state.hits;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Couldn't load recommendations from people you follow.")).toHaveCount(0);
  expect(recs.state.hits).toBeGreaterThan(before);
});

test("Calendar: a failed load shows an error with Retry, not 'no releases'", async ({ page }) => {
  const movies = flaky((r) =>
    r.fulfill({
      json: {
        results: [{
          id: 4242, title: "Upcoming Film", release_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
          poster_path: null, vote_average: 7, genre_ids: [], overview: "", backdrop_path: null,
        }],
        page: 1, total_pages: 1, total_results: 1,
      },
    })
  );
  await page.route("**/api/tmdb/discover/movie**", movies.handler);
  await page.route("**/api/tmdb/discover/tv**", (r) =>
    r.fulfill({ json: { results: [], page: 1, total_pages: 1, total_results: 0 } })
  );
  await page.goto("/calendar");

  await expect(page.getByText("Couldn't load upcoming releases")).toBeVisible();
  await expect(page.locator(".ant-empty")).toHaveCount(0);

  movies.heal();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Upcoming Film")).toBeVisible();
});

test("Profile: a failed TMDB status check says so instead of offering Connect", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone layout reaches the profile through the More drawer; one viewport is enough");
  const status = flaky((r) => r.fulfill({ json: { connected: true } }));
  await page.route("**/api/tmdb-auth/status/**", status.handler);
  await page.goto("/watchlist");
  await openProfile(page);
  await page.locator(".ant-modal").getByRole("tab", { name: "Data & TMDB" }).click();

  await expect(page.getByText("Couldn't check your TMDB connection.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect TMDB Account" })).toHaveCount(0);

  status.heal();
  await page.locator(".ant-modal").getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".ant-modal").getByText("Connected")).toBeVisible();
});

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page.locator(".ant-modal")).toBeVisible();
}

test("Calendar: a slow 'All' response can't overwrite a later 'TV Shows' pick", async ({ page }) => {
  const day = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const page1 = (results: unknown[]) => ({ results, page: 1, total_pages: 1, total_results: results.length });
  let releaseMovies!: () => void;
  const moviesHeld = new Promise<void>((r) => (releaseMovies = r));
  await page.route("**/api/tmdb/discover/movie**", async (route) => {
    await moviesHeld; // the initial "All" load is stuck on its movie half
    await route.fulfill({
      json: page1([{ id: 1, title: "Slow Movie", release_date: day, poster_path: null, vote_average: 7, genre_ids: [] }]),
    });
  });
  await page.route("**/api/tmdb/discover/tv**", (route) =>
    route.fulfill({
      json: page1([{ id: 2, name: "Quick Show", first_air_date: day, poster_path: null, vote_average: 7, genre_ids: [] }]),
    })
  );
  await page.goto("/calendar");
  await page.locator(".ant-radio-button-wrapper", { hasText: "TV Shows" }).click();
  await expect(page.getByText("Quick Show")).toBeVisible();

  releaseMovies(); // "All" now finishes last
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Quick Show")).toBeVisible();
  await expect(page.getByText("Slow Movie")).toHaveCount(0);
});

test.describe("dates on the device's own day", () => {
  test.use({ timezoneId: "America/New_York" });

  test("Lists: a list created late in the evening shows its local day", async ({ page }) => {
    // 23:30 in New York on 15 Jan = 04:30 UTC on 16 Jan.
    const list = { id: 5, name: "Late Night", description: "", createdAt: "2024-01-16T04:30:00Z", items: [] };
    await page.route("**/api/lists/**", (r) => r.fulfill({ json: paginated([list]) }));
    await page.goto("/lists");
    await expect(page.getByText("15-01-2024")).toBeVisible();
    await expect(page.getByText("16-01-2024")).toHaveCount(0);
  });
});
