import { test, expect, mockAuthedBase } from "./fixtures";

const MOCK_MOVIES = Array.from({ length: 6 }, (_, i) => ({
  id: 100 + i,
  title: `Movie ${i + 1}`,
  overview: "Test overview",
  poster_path: null,
  backdrop_path: null,
  release_date: "2024-01-01",
  vote_average: 7.0 + i * 0.1,
  vote_count: 500,
  genre_ids: [28],
  popularity: 100,
  adult: false,
  original_language: "en",
  original_title: `Movie ${i + 1}`,
  video: false,
}));

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);

  // Mock TMDB movie endpoints
  const movieResponse = { results: MOCK_MOVIES, total_pages: 3, total_results: 60, page: 1 };
  await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: movieResponse }));
  await page.route("**/api/tmdb/trending/**", (route) => route.fulfill({ json: movieResponse }));
  await page.route("**/api/tmdb/movie/**", (route) => route.fulfill({ json: movieResponse }));
  await page.route("**/api/tmdb/search/movie**", (route) =>
    route.fulfill({ json: { results: MOCK_MOVIES.slice(0, 2), total_pages: 1, total_results: 2, page: 1 } })
  );
});

test.describe("Movies page", () => {
  test("renders movie cards", async ({ page }) => {
    await page.goto("/movies");
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 10_000 });
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(6);
  });

  test("category buttons are visible", async ({ page }) => {
    await page.goto("/movies");
    await expect(page.getByRole("button", { name: "Discover" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Now Playing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Top Rated" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Popular" })).toBeVisible();
  });

  test("clicking Details navigates to movie detail page", async ({ page }) => {
    await page.route("**/api/tmdb/movie/100**", (route) =>
      route.fulfill({
        json: {
          id: 100, title: "Movie 1", overview: "Test", release_date: "2024-01-01",
          poster_path: null, backdrop_path: null, genres: [], runtime: 120,
          vote_average: 7.5, vote_count: 200, status: "Released",
          original_language: "en", budget: 0, revenue: 0,
          credits: { cast: [], crew: [] }, images: { backdrops: [] },
          videos: { results: [] }, recommendations: { results: [] },
          certifications: [],
        },
      })
    );
    await page.route("**/api/tmdb/movie/100/reviews**", (route) =>
      route.fulfill({ json: { results: [], total_pages: 1 } })
    );
    await page.route("**/api/tmdb/movie/100/similar**", (route) =>
      route.fulfill({ json: { results: [], total_pages: 1 } })
    );
    await page.route("**/api/tmdb/movie/100/watch*", (route) =>
      route.fulfill({ json: { results: {} } })
    );
    await page.route("**/api/tmdb/movie/100/release_dates**", (route) =>
      route.fulfill({ json: { results: [] } })
    );
    await page.route("**/api/tmdb/person/**", (route) =>
      route.fulfill({ json: { id: 1, name: "Actor", profile_path: null } })
    );

    await page.goto("/movies");
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 10_000 });
    // Button text is "Details" but aria-label is "Know more about..." — filter by text content
    await page.locator("button").filter({ hasText: "Details" }).first().click();

    await expect(page).toHaveURL(/\/movie\/100/);
  });
});

test.describe("TV page", () => {
  test("renders TV show cards", async ({ page }) => {
    const tvResponse = {
      results: MOCK_MOVIES.map((m) => ({ ...m, name: m.title, first_air_date: "2024-01-01" })),
      total_pages: 2,
      total_results: 20,
      page: 1,
    };
    await page.route("**/api/tmdb/tv/**", (route) => route.fulfill({ json: tvResponse }));
    await page.route("**/api/tmdb/discover/tv**", (route) => route.fulfill({ json: tvResponse }));

    await page.goto("/tv");
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Search", () => {
  test("searching navigates to /search", async ({ page }, testInfo) => {
    await page.goto("/movies");
    // Below 768px the sidebar (and its search box) is hidden by CSS; the phone
    // layout opens search from the bottom nav instead.
    if (testInfo.project.name === "mobile-chrome") {
      await page.locator(".app-bottom-nav").getByRole("button", { name: "Search" }).click();
    }
    const box = page.getByPlaceholder(/search/i).filter({ visible: true });
    await box.fill("inception");
    await box.press("Enter");
    await expect(page).toHaveURL("/search?q=inception");
    await expect(page.getByText(/Results for/i)).toBeVisible();
  });
});
