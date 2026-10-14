import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { WatchedEntryDTO, WatchlistEntryDTO } from "../src/types/domain";
import type { TMDBMovieSummary } from "../src/types/tmdb";

const MOCK_MOVIE = {
  id: 550, title: "Fight Club", overview: "...", poster_path: "/poster.jpg",
  backdrop_path: null, release_date: "1999-10-15", vote_average: 8.4,
  vote_count: 1000, genre_ids: [18], popularity: 80, original_language: "en",
} satisfies TMDBMovieSummary;

const FIGHT_CLUB_ENTRY = {
  id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club",
  posterPath: null, voteAverage: 8.4, addedAt: new Date().toISOString(),
} satisfies WatchlistEntryDTO;

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
          watchedTz: "", originalLanguage: "en", releaseYear: 1999, runtimeMinutes: 139, platform: null,
        } satisfies WatchedEntryDTO]),
      })
    );

    await page.goto("/watched");
    await expect(page.getByText("Watched (1)")).toBeVisible();
    await expect(page.getByText("Fight Club")).toBeVisible();
  });

  test("a watched history longer than one page loads every entry", async ({ page }) => {
    const entry = (id: number, title: string) => ({
      id, mediaId: id, mediaType: "movie", title,
      posterPath: null, voteAverage: 7, watchedAt: new Date(Date.UTC(2026, 0, id)).toISOString(),
      watchedTz: "", originalLanguage: "en", releaseYear: 2000, runtimeMinutes: 100, platform: null,
    } satisfies WatchedEntryDTO);
    const requested: URLSearchParams[] = [];
    await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([]) }));
    await page.route("**/api/watched/**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      requested.push(params);
      return route.fulfill({
        json: params.get("page") === "2"
          ? paginated([entry(1, "Page Two Film")], { count: 3 })
          : paginated([entry(3, "First Film"), entry(2, "Second Film")], {
              count: 3, next: "/api/watched/?page=2&page_size=500",
            }),
      });
    });

    await page.goto("/watched");
    await expect(page.getByText("Watched (3)")).toBeVisible();
    for (const title of ["First Film", "Second Film", "Page Two Film"]) {
      await expect(page.getByText(title)).toBeVisible();
    }
    expect(requested.map((p) => [p.get("page"), p.get("page_size")])).toEqual([["1", "500"], ["2", "500"]]);
  });
});
