import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated, movieDetail, tvDetail } from "./fixtures";
import type { FollowedPersonEntry, PersonalizedRecSection } from "../src/api/userApi";
import type { UserListDTO, UserListItemDTO, WatchedEntryDTO, WatchlistEntryDTO } from "../src/types/domain";

/** The row of Statistic facts (rating, runtime, seasons...) under the title. */
const factsRow = (page: Page) =>
  page.locator(".ant-statistic").first().locator("xpath=ancestor::div[contains(@class,'ant-row')][1]");
const BARE_ZERO = /(^|\s)0(\s|$)/;

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
  await page.route("**/api/episode-progress/**", (route) => route.fulfill({ json: null }));
});

test.describe("Detail facts", () => {
  test("a runtime of 0 renders no stray 0", async ({ page }) => {
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail({ runtime: 0 }) }));
    await page.goto("/movie/100");
    const facts = factsRow(page);
    await expect(facts).toContainText("TMDB Rating");
    await expect(page.getByText("Runtime", { exact: true })).toHaveCount(0);
    expect(await facts.innerText()).not.toMatch(BARE_ZERO);
  });

  test("zero seasons and episodes are hidden", async ({ page }) => {
    await page.route("**/api/tmdb/tv/200**", (route) =>
      route.fulfill({ json: tvDetail({ number_of_seasons: 1, number_of_episodes: 0 }) }));
    await page.goto("/tv/200");
    await expect(page.getByText("Seasons", { exact: true })).toBeVisible();
    await expect(page.getByText("Episodes", { exact: true })).toHaveCount(0);
    expect(await factsRow(page).innerText()).not.toMatch(BARE_ZERO);
  });
});

test.describe("Where to Watch", () => {
  const provider = { provider_id: 2, provider_name: "Apple TV", logo_path: "/apple.png", display_priority: 1 };

  test("a buy-only title shows Buy and no empty headings", async ({ page }) => {
    await page.route("**/api/tmdb/movie/100**", (route) =>
      route.fulfill({ json: movieDetail({ "watch/providers": { results: { US: { link: "https://x.test", buy: [provider] } } } }) }));
    await page.goto("/movie/100");
    await expect(page.getByText("Buy", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Apple TV" })).toBeVisible();
    await expect(page.getByText("Streaming", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Rent", { exact: true })).toHaveCount(0);
  });

  test("no US providers says so for the US", async ({ page }) => {
    await page.route("**/api/tmdb/movie/100**", (route) =>
      route.fulfill({ json: movieDetail({ "watch/providers": { results: { GB: { flatrate: [provider] } } } }) }));
    await page.goto("/movie/100");
    await expect(page.getByText("Not available to stream, rent or buy in your region (United States).")).toBeVisible();
    await expect(page.getByText(/Showing United States availability/)).toHaveCount(0);
  });

  test("changing the region in Edit Profile changes Where to Watch", async ({ page, isMobile }) => {
    await page.route("**/api/tmdb/movie/100**", (route) =>
      route.fulfill({ json: movieDetail({ "watch/providers": { results: { GB: { link: "https://x.test", flatrate: [provider] } } } }) }));
    await page.route("**/api/tmdb/watch/providers/regions**", (route) => route.fulfill({
      json: { results: [
        { iso_3166_1: "US", english_name: "United States of America" },
        { iso_3166_1: "GB", english_name: "United Kingdom" },
      ] },
    }));
    await page.route("**/api/tmdb-auth/status/**", (r) => r.fulfill({ json: { connected: false } }));
    await page.goto("/movie/100");
    await expect(page.getByText("Not available to stream, rent or buy in your region (United States).")).toBeVisible();

    if (isMobile) await page.getByRole("button", { name: "More navigation options" }).click();
    await page.getByRole("button", { name: "Edit profile" }).click();
    await page.getByRole("tab", { name: "Data & TMDB" }).click();
    await page.locator(".ant-select", { has: page.locator("#profile-region") }).click();
    await page.getByRole("combobox", { name: "Region" }).fill("United King");
    await page.locator(".ant-select-item-option[title=\"United Kingdom\"]").click();
    await page.locator(".ant-modal").filter({ hasText: "Edit Profile" }).getByRole("button", { name: "Close" }).click();

    await expect(page.getByRole("img", { name: "Apple TV" })).toBeVisible();
    await expect(page.getByText("Region: United Kingdom")).toBeVisible();
    await expect(page.getByText(/Not available to stream/)).toHaveCount(0);
  });
});

const BROWSE_MOVIES = Array.from({ length: 3 }, (_, i) => ({
  id: 100 + i, title: `Movie ${i + 1}`, overview: "Test overview", poster_path: null,
  backdrop_path: i === 0 ? "/hero.jpg" : null, release_date: "2024-01-01", vote_average: 7,
  vote_count: 500, genre_ids: [28], popularity: 100, adult: false, original_language: "en",
  original_title: `Movie ${i + 1}`, video: false,
}));

async function mockBrowseMovies(page: Page) {
  const list = { results: BROWSE_MOVIES, total_pages: 1, total_results: 3, page: 1 };
  await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: list }));
  await page.route("**/api/tmdb/trending/**", (route) => route.fulfill({ json: list }));
  await page.route("**/api/tmdb/movie/**", (route) => route.fulfill({ json: list }));
  await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));
}

test.describe("Browse cards are links", () => {
  test("the poster is a link named after the title", async ({ page }) => {
    await mockBrowseMovies(page);
    await page.goto("/movies");
    const grid = page.getByRole("main", { name: "Movie results" });
    const link = grid.getByRole("link", { name: "Movie 1" });
    await expect(link).toHaveAttribute("href", "/movie/100");
  });

  test("Enter on the poster opens the title and Back restores the category", async ({ page }) => {
    await mockBrowseMovies(page);
    await page.goto("/movies");
    await page.getByRole("button", { name: "Top Rated" }).click();
    await expect(page.getByRole("button", { name: "Top Rated" })).toHaveClass(/ant-btn-primary/);
    await page.getByRole("main", { name: "Movie results" }).getByRole("link", { name: "Movie 1" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/movie/100");
    await page.goBack();
    await expect(page).toHaveURL("/movies");
    await expect(page.getByRole("button", { name: "Top Rated" })).toHaveClass(/ant-btn-primary/);
  });

  test("a modifier click leaves the grid in place", async ({ page }) => {
    await mockBrowseMovies(page);
    await page.goto("/movies");
    const link = page.getByRole("main", { name: "Movie results" }).getByRole("link", { name: "Movie 1" });
    const popupPromise = page.context().waitForEvent("page");
    await link.click({ modifiers: ["ControlOrMeta"] });
    const popup = await popupPromise;
    await popup.close();
    await expect(page).toHaveURL("/movies");
  });

  test("the hero's View Details is a link", async ({ page }) => {
    await mockBrowseMovies(page);
    await page.goto("/movies");
    const details = page.getByRole("link", { name: "View Details" });
    await expect(details).toHaveAttribute("href", "/movie/100");
    await details.click();
    await expect(page).toHaveURL("/movie/100");
  });
});

test.describe("Back from a recommendation card", () => {
  test("Following → detail → Back returns to Following", async ({ page }) => {
    const followed = [{ id: 1, personId: 7, name: "Greta Gerwig", profilePath: null, followedAt: "2026-10-01T10:00:00Z" }] satisfies FollowedPersonEntry[];
    const recs = [{
      key: "person-7", label: "Because you follow Greta Gerwig",
      items: [{ id: 100, type: "movie", title: "Movie 1", posterPath: null, voteAverage: 7.5 }],
    }] satisfies PersonalizedRecSection[];
    await page.route("**/api/followed-people/**", (route) => route.fulfill({ json: paginated(followed) }));
    await page.route("**/api/recommendations/followed-people/**", (route) => route.fulfill({ json: recs }));
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));

    await page.goto("/following");
    await page.getByRole("link", { name: "Movie 1" }).click();
    await expect(page).toHaveURL("/movie/100");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL("/following");
  });
});

test.describe("Mark as Watched runtime", () => {
  /** Answers the watched POST like the API and records its body. */
  async function mockWatchedPost(page: Page) {
    const posted: Array<Record<string, unknown>> = [];
    await page.route("**/api/watched/**", (route) => {
      if (route.request().method() !== "POST") return route.fulfill({ json: paginated([]) });
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posted.push(body);
      return route.fulfill({
        status: 201,
        json: {
          id: 1, mediaId: body.mediaId as number, mediaType: body.mediaType as "movie" | "tv", title: String(body.title),
          posterPath: null, voteAverage: 7.5, watchedAt: new Date().toISOString(), watchedTz: "",
          originalLanguage: "en", releaseYear: 2020, runtimeMinutes: body.runtimeMinutes as number, platform: null,
        } satisfies WatchedEntryDTO,
      });
    });
    return posted;
  }

  test("a series prefills episodes × runtime and keeps the user's edit", async ({ page }) => {
    const posted = await mockWatchedPost(page);
    await page.route("**/api/tmdb/tv/200**", (route) =>
      route.fulfill({ json: tvDetail({ number_of_episodes: 62, episode_run_time: [47] }) }));
    await page.goto("/tv/200");
    await page.getByRole("button", { name: /mark as watched/i }).first().click();
    const runtime = page.getByLabel("Runtime (minutes)");
    await expect(runtime).toHaveValue("2914");
    await expect(runtime).toBeEditable();
    await runtime.fill("3000");
    await page.getByRole("button", { name: "Mark Watched" }).click();
    await expect.poll(() => posted.length).toBe(1);
    expect(posted[0]?.runtimeMinutes).toBe(3000);
  });

  test("malformed provider data still prefills the runtime", async ({ page }) => {
    await mockWatchedPost(page);
    await page.route("**/api/tmdb/movie/100**", (route) =>
      route.fulfill({ json: movieDetail({ runtime: 139, "watch/providers": "oops" }) }));
    await page.goto("/movie/100");
    await page.getByRole("button", { name: /mark as watched/i }).first().click();
    await expect(page.getByLabel("Runtime (minutes)")).toHaveValue("139");
    await page.getByLabel("Watched on (optional)").click();
    await expect(page.locator(".ant-select-item-option")).toHaveText(["Other"]);
  });
});

test.describe("Person crew credits", () => {
  async function mockDirector(page: Page, knownFor = "Directing") {
    await page.route("**/api/tmdb/person/7**", (route) => route.fulfill({ json: {
      id: 7, name: "Greta Gerwig", profile_path: null, known_for_department: knownFor, biography: "",
      birthday: null, deathday: null, place_of_birth: null, popularity: 10, imdb_id: null, homepage: null,
    } }));
    await page.route("**/api/tmdb/person/7/movie_credits**", (route) => route.fulfill({ json: {
      cast: [{ id: 1, title: "Cameo Film", character: "Herself", poster_path: null, release_date: "2010-01-01", vote_average: 6 }],
      crew: [
        { id: 2, title: "Old Film", job: "Director", poster_path: null, release_date: "2017-11-03", vote_average: 7 },
        { id: 3, title: "New Film", job: "Director", poster_path: null, release_date: "2023-07-21", vote_average: 7 },
        { id: 3, title: "New Film", job: "Writer", poster_path: null, release_date: "2023-07-21", vote_average: 7 },
      ],
    } }));
    await page.route("**/api/tmdb/person/7/tv_credits**", (route) => route.fulfill({ json: { cast: [], crew: [] } }));
    await page.route("**/api/tmdb/person/7/images**", (route) => route.fulfill({ json: { profiles: [] } }));
  }

  test("a director's page opens on Crew with jobs joined, newest first", async ({ page }) => {
    await mockDirector(page);
    await page.goto("/person/7");
    await expect(page.getByRole("tab", { name: "Crew (2)" })).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel");
    const links = panel.getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAccessibleName("New Film");
    await expect(links.nth(0)).toHaveAttribute("href", "/movie/3");
    await expect(panel.getByText("Director, Writer")).toBeVisible();
    // The acting cameo is still there, in its own tab.
    await expect(page.getByRole("tab", { name: "Movies (1)" })).toBeVisible();
  });

  test("an actor's page still opens on Movies", async ({ page }) => {
    await mockDirector(page, "Acting");
    await page.goto("/person/7");
    await expect(page.getByRole("tab", { name: "Movies (1)" })).toHaveAttribute("aria-selected", "true");
  });

  test("Follow is disabled while the followed list failed to load", async ({ page }) => {
    await mockDirector(page);
    await page.route("**/api/followed-people/**", (route) => route.fulfill({ status: 500, json: {} }));
    await page.goto("/person/7");
    await expect(page.getByRole("heading", { name: "Greta Gerwig" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(user-add )?Follow$/ })).toBeDisabled();
  });
});

test.describe("Recent searches", () => {
  test("a search from the bottom nav shows in the sidebar's recents", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/watchlist");
    await page.locator(".app-bottom-nav").getByRole("button", { name: "Search" }).click();
    const phoneBox = page.getByPlaceholder(/search/i).filter({ visible: true });
    await phoneBox.fill("Dune");
    await phoneBox.press("Enter");
    await expect(page).toHaveURL("/search?q=Dune");

    // The sidebar's search box was mounted (CSS-hidden) the whole time.
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator(".app-sidebar").getByPlaceholder(/search/i).fill("");
    await page.locator(".app-sidebar").getByPlaceholder(/search/i).focus();
    await expect(page.locator(".app-sidebar").getByRole("menuitem", { name: "Dune" })).toBeVisible();
  });
});

test.describe("Watchlist scroll restore", () => {
  const ENTRIES = Array.from({ length: 48 }, (_, i) => ({
    id: i + 1, mediaId: 1000 + i, mediaType: "movie", title: `Saved ${i + 1}`, posterPath: null,
    voteAverage: 7, addedAt: new Date(Date.UTC(2026, 0, 1) - i * 60_000).toISOString(),
  }) satisfies WatchlistEntryDTO);
  const LAST = ENTRIES[ENTRIES.length - 1]!;

  async function openFromScrolledWatchlist(page: Page) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated(ENTRIES) }));
    await page.route("**/api/tmdb/movie/**", (route) => route.fulfill({ json: movieDetail({ id: LAST.mediaId, title: LAST.title }) }));
    await page.goto("/watchlist");
    const link = page.getByRole("link", { name: LAST.title });
    await link.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await link.click();
    await expect(page).toHaveURL(`/movie/${LAST.mediaId}`);
  }

  test("Back from the detail page restores the position", async ({ page }) => {
    await openFromScrolledWatchlist(page);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL("/watchlist");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test("browser Back restores the position", async ({ page }) => {
    await openFromScrolledWatchlist(page);
    await page.goBack();
    await expect(page).toHaveURL("/watchlist");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test("a later visit from the sidebar starts at the top", async ({ page }) => {
    await openFromScrolledWatchlist(page);
    await page.route("**/api/tmdb/discover/movie**", (route) =>
      route.fulfill({ json: { results: [], total_pages: 1, total_results: 0, page: 1 } }));
    await page.getByRole("menuitem", { name: "Movies" }).click();
    await expect(page).toHaveURL("/movies");
    await expect(page.getByRole("button", { name: "Top Rated" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Watchlist" }).click();
    await expect(page).toHaveURL("/watchlist");
    await expect(page.getByRole("link", { name: LAST.title })).toBeAttached();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("Anime hero", () => {
  test("features an anime, never a trending non-anime title", async ({ page }) => {
    const show = (id: number, name: string, backdrop: string | null) => ({
      id, name, overview: "x", poster_path: null, backdrop_path: backdrop, first_air_date: "2024-01-01",
      vote_average: 8, vote_count: 10, genre_ids: [16], popularity: 1, original_language: "ja", origin_country: ["JP"],
    });
    const page1 = (results: unknown[]) => ({ results, total_pages: 1, total_results: results.length, page: 1 });
    await page.route("**/api/tmdb/trending/**", (route) => route.fulfill({ json: page1([show(1, "Pixar Thing", "/p.jpg")]) }));
    await page.route("**/api/tmdb/discover/tv**", (route) =>
      route.fulfill({ json: page1([show(2, "No Backdrop Anime", null), show(3, "Anime Show", "/a.jpg")]) }));

    await page.goto("/anime");
    await expect(page.getByRole("heading", { level: 1, name: "Anime Show" })).toBeVisible();
    await expect(page.getByText("Pixar Thing")).toHaveCount(0);
  });
});

test.describe("Browse grids hide watched titles", () => {
  const watchedMovie1 = {
    id: 1, mediaId: 100, mediaType: "movie", title: "Movie 1", posterPath: null, voteAverage: 7,
    watchedAt: "2026-01-01T00:00:00Z", watchedTz: "", originalLanguage: "en", releaseYear: 2024,
    runtimeMinutes: 120, platform: null,
  } satisfies WatchedEntryDTO;

  test("a watched title is left out of the Movies grid", async ({ page }) => {
    await mockBrowseMovies(page);
    await page.route("**/api/watched/**", (route) => route.fulfill({ json: paginated([watchedMovie1]) }));
    await page.goto("/movies");
    const grid = page.getByRole("main", { name: "Movie results" });
    await expect(grid.getByRole("link", { name: "Movie 2" })).toBeVisible();
    await expect(grid.getByRole("link", { name: "Movie 1" })).toHaveCount(0);
  });

  test("search results still include it, shown as watched", async ({ page }) => {
    await page.route("**/api/watched/**", (route) => route.fulfill({ json: paginated([watchedMovie1]) }));
    await page.route("**/api/tmdb/search/movie**", (route) =>
      route.fulfill({ json: { results: [BROWSE_MOVIES[0]], total_pages: 1, total_results: 1, page: 1 } }));
    await page.goto("/search?q=Movie");
    await expect(page.getByRole("link", { name: "Movie 1" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Unmark watched: Movie 1" })).toBeVisible();
  });

  test("search result cards have the browse cards' watchlist button, named per title", async ({ page }) => {
    await page.route("**/api/tmdb/search/movie**", (route) =>
      route.fulfill({ json: { results: [BROWSE_MOVIES[0]], total_pages: 1, total_results: 1, page: 1 } }));
    await page.goto("/search?q=Movie");
    await expect(page.getByRole("button", { name: "Add to watchlist: Movie 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as watched: Movie 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Know more about Movie 1" })).toBeVisible();
  });
});

test.describe("Add to List dialog", () => {
  const LISTS = [
    { id: 1, name: "Favourites", description: "", items: [], createdAt: "2026-01-01T00:00:00Z" },
    { id: 2, name: "Weekend", description: "", items: [], createdAt: "2026-01-02T00:00:00Z" },
  ] satisfies UserListDTO[];

  test("reopening starts with an empty search", async ({ page }) => {
    await page.route("**/api/lists/**", (route) => route.fulfill({ json: paginated(LISTS) }));
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));
    await page.goto("/movie/100");
    const open = page.getByRole("button", { name: /Add to List/i });
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Add to List" });
    await dialog.getByPlaceholder("Search lists…").fill("Fav");
    await expect(dialog.getByText("Weekend")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toBeHidden();

    await open.click();
    await expect(dialog.getByPlaceholder("Search lists…")).toHaveValue("");
    await expect(dialog.getByText("Weekend")).toBeVisible();
  });

  test("each list is a named checkbox that Space toggles", async ({ page }) => {
    const added: string[] = [];
    await page.route("**/api/lists/**", (route) => {
      if (route.request().method() === "POST") {
        added.push(new URL(route.request().url()).pathname);
        return route.fulfill({ status: 201, json: {
          id: 9, mediaId: 100, mediaType: "movie", title: "Movie 1", posterPath: null, voteAverage: 7, addedAt: "2026-01-03T00:00:00Z",
        } satisfies UserListItemDTO });
      }
      return route.fulfill({ json: paginated(LISTS) });
    });
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));
    await page.goto("/movie/100");
    await page.getByRole("button", { name: /Add to List/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add to List" });
    const fav = dialog.getByRole("checkbox", { name: "Favourites" });
    await expect(fav).not.toBeChecked();
    await fav.focus();
    await page.keyboard.press("Space");
    await expect(fav).toBeChecked();
    expect(added).toEqual(["/api/lists/1/items/"]);
  });

  test("a failed lists load shows Retry, not \"No lists yet\"", async ({ page }) => {
    let fail = true;
    await page.route("**/api/lists/**", (route) =>
      fail ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: paginated(LISTS) }));
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));
    await page.goto("/movie/100");
    await page.getByRole("button", { name: /Add to List/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add to List" });
    await expect(dialog.getByText("Couldn't load your lists")).toBeVisible();
    await expect(dialog.getByText(/No lists yet/)).toHaveCount(0);

    fail = false;
    await dialog.getByRole("button", { name: "Retry" }).click();
    await expect(dialog.getByText("Favourites")).toBeVisible();
  });
});

test.describe("Back with no in-app history", () => {
  test("a detail page opened directly (new tab, bookmark) goes back to its section", async ({ page }) => {
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));
    await page.goto("/movie/100");
    await expect(page.getByRole("heading", { name: "Movie 1" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL("/movies");
  });

  test("a show opened directly goes back to TV Shows", async ({ page }) => {
    await page.route("**/api/tmdb/tv/200**", (route) => route.fulfill({ json: tvDetail() }));
    await page.route("**/api/tmdb/tv/200/season/**", (route) => route.fulfill({ json: { episodes: [] } }));
    await page.goto("/tv/200");
    await expect(page.getByRole("heading", { name: "Show 1" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL("/tv");
  });
});
