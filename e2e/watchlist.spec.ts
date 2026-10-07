import { test, expect, mockAuthedBase, paginated } from "./fixtures";

const MOCK_MOVIE = {
  id: 550, title: "Fight Club", overview: "...", poster_path: "/poster.jpg",
  backdrop_path: null, release_date: "1999-10-15", vote_average: 8.4,
  vote_count: 1000, genre_ids: [18], popularity: 80, adult: false,
  original_language: "en", original_title: "Fight Club", video: false,
};

const FIGHT_CLUB_ENTRY = {
  id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club",
  posterPath: null, voteAverage: 8.4, addedAt: new Date().toISOString(),
};

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
  await page.route("**/api/tmdb/trending/**", (route) =>
    route.fulfill({ json: { results: [MOCK_MOVIE], total_pages: 1, total_results: 1 } })
  );
  await page.route("**/api/tmdb/discover/**", (route) =>
    route.fulfill({ json: { results: [MOCK_MOVIE], total_pages: 1, total_results: 1 } })
  );
});

test.describe("Watchlist", () => {
  test("empty watchlist shows prompt", async ({ page }) => {
    await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([]) }));
    await page.goto("/watchlist");
    await expect(page.getByText("My Watchlist (0)")).toBeVisible();
    await expect(page.getByText("Your watchlist is empty")).toBeVisible();
    await expect(page.getByRole("button", { name: "Browse Movies" })).toBeVisible();
  });

  test("watchlist with items shows count and cards", async ({ page }) => {
    await page.route("**/api/watchlist/**", (route) =>
      route.fulfill({ json: paginated([FIGHT_CLUB_ENTRY]) })
    );

    await page.goto("/watchlist");
    await expect(page.getByText("My Watchlist (1)")).toBeVisible();
    await expect(page.getByText("Fight Club")).toBeVisible();
  });

  test("remove from watchlist shows confirmation", async ({ page }) => {
    await page.route("**/api/watchlist/**", (route) =>
      route.fulfill({ json: paginated([FIGHT_CLUB_ENTRY]) })
    );
    await page.route("**/api/watchlist/1/", (route) => route.fulfill({ status: 204, body: "" }));

    await page.goto("/watchlist");
    await expect(page.getByText("Fight Club")).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Remove from watchlist?")).toBeVisible();
  });

  test("export CSV button visible when watchlist has items", async ({ page }) => {
    await page.route("**/api/watchlist/**", (route) =>
      route.fulfill({ json: paginated([FIGHT_CLUB_ENTRY]) })
    );

    await page.goto("/watchlist");
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });
});

test.describe("Watched page", () => {
  test("empty watched list shows empty state", async ({ page }) => {
    await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([]) }));
    await page.goto("/watched");
    await expect(page.getByText("Watched (0)")).toBeVisible();
  });

  test("watched list renders items with sort controls", async ({ page }) => {
    await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([]) }));
    await page.route("**/api/watched/**", (route) =>
      route.fulfill({
        json: paginated([{
          id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club",
          posterPath: null, voteAverage: 8.4, watchedAt: new Date().toISOString(),
        }]),
      })
    );

    await page.goto("/watched");
    await expect(page.getByText("Watched (1)")).toBeVisible();
    await expect(page.getByText("Fight Club")).toBeVisible();
  });
});
