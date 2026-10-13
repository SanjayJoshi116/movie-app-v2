import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { PersonalizedRecSection } from "../src/api/userApi";
import type { WatchedEntryDTO } from "../src/types/domain";

// browse-filters: Anime "Airing Today" uses the device's date, and switching
// the Anime media type drops genre picks. view-state-restore: For You left
// mid-computation resumes polling on return.

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

const tmdbPage = (results: object[]) => ({ results, page: 1, total_pages: 1, total_results: results.length });
const animeTv = { id: 501, name: "Grid Anime Show", poster_path: null, backdrop_path: null, first_air_date: "2020-01-01", vote_average: 8, genre_ids: [16], overview: "" };
const animeMovie = { id: 601, title: "Grid Anime Movie", poster_path: null, backdrop_path: null, release_date: "2020-01-01", vote_average: 8, genre_ids: [16], overview: "" };

/** Every discover URL the page requests, by media type. */
function recordDiscover(page: Page) {
  const urls = { tv: [] as URL[], movie: [] as URL[] };
  page.on("request", (r) => {
    const m = r.url().match(/\/api\/tmdb\/discover\/(tv|movie)\b/);
    if (m) urls[m[1] as "tv" | "movie"].push(new URL(r.url()));
  });
  return urls;
}

test.describe("Anime Airing Today", () => {
  // 20:00 UTC on 10 March is already 01:30 on 11 March in India.
  test.use({ timezoneId: "Asia/Kolkata" });

  test("asks for episodes airing on the device's local date", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-03-10T20:00:00Z"));
    await page.route("**/api/tmdb/discover/tv**", (route) => route.fulfill({ json: tmdbPage([animeTv]) }));
    await page.goto("/anime");
    await expect(page.getByText("Grid Anime Show").first()).toBeVisible();

    const airing = page.waitForRequest((r) => r.url().includes("/api/tmdb/discover/tv") && r.url().includes("air_date.gte"));
    await page.getByRole("button", { name: "Airing Today" }).click();
    const url = new URL((await airing).url());
    expect(url.searchParams.get("air_date.gte")).toBe("2026-03-11");
    expect(url.searchParams.get("air_date.lte")).toBe("2026-03-11");
  });
});

test.describe("Anime media-type switch", () => {
  async function pickDrama(page: Page) {
    await page.getByRole("button", { name: "Toggle filters" }).click();
    const drawer = page.locator(".ant-drawer-content").filter({ hasText: "Filter & Sort" });
    await drawer.getByText("Drama", { exact: true }).click();
    await drawer.getByRole("button", { name: "Apply Filters" }).click();
    await expect(drawer).toBeHidden();
  }

  test("TV → Movies drops the genre pick", async ({ page }) => {
    await page.route("**/api/tmdb/discover/tv**", (route) => route.fulfill({ json: tmdbPage([animeTv]) }));
    await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: tmdbPage([animeMovie]) }));
    const urls = recordDiscover(page);
    await page.goto("/anime");
    await expect(page.getByText("Grid Anime Show").first()).toBeVisible();

    const withGenre = page.waitForRequest((r) => r.url().includes("/api/tmdb/discover/tv") && r.url().includes("with_genres=18"));
    await pickDrama(page);
    await withGenre;

    await page.getByText("Anime Movies", { exact: true }).click();
    await expect(page.getByText("Grid Anime Movie").first()).toBeVisible();
    expect(urls.movie.length).toBeGreaterThan(0);
    for (const url of urls.movie) expect(url.searchParams.has("with_genres"), url.href).toBe(false);
  });

  test("Movies → TV drops the genre pick", async ({ page }) => {
    await page.route("**/api/tmdb/discover/tv**", (route) => route.fulfill({ json: tmdbPage([animeTv]) }));
    await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: tmdbPage([animeMovie]) }));
    const urls = recordDiscover(page);
    await page.goto("/anime");
    await page.getByText("Anime Movies", { exact: true }).click();
    await expect(page.getByText("Grid Anime Movie").first()).toBeVisible();

    const withGenre = page.waitForRequest((r) => r.url().includes("/api/tmdb/discover/movie") && r.url().includes("with_genres=18"));
    await pickDrama(page);
    await withGenre;

    const tvBefore = urls.tv.length;
    await page.getByText("TV Anime", { exact: true }).click();
    await expect.poll(() => urls.tv.length).toBeGreaterThan(tvBefore);
    await expect(page.getByText("Grid Anime Show").first()).toBeVisible();
    for (const url of urls.tv.slice(tvBefore)) expect(url.searchParams.has("with_genres"), url.href).toBe(false);
  });
});

test.describe("For You left mid-computation", () => {
  const WATCHED = {
    id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club", posterPath: null, voteAverage: 8.4,
    watchedAt: "2024-01-15T10:00:00Z", watchedTz: "", originalLanguage: "en", releaseYear: 1999,
    runtimeMinutes: 139, platform: null,
  } satisfies WatchedEntryDTO;
  const FOR_YOU = [{
    key: "trending", label: "Trending For You",
    items: [{ id: 100, type: "movie", title: "Movie 1", posterPath: null, voteAverage: 7.5 }],
  }] satisfies PersonalizedRecSection[];
  const PERSONALIZED = [{
    key: "because-550", label: "Because you watched Fight Club",
    items: [{ id: 101, type: "movie", title: "Movie 2", posterPath: null, voteAverage: 7.1 }],
  }] satisfies PersonalizedRecSection[];

  test("polls again on return and shows the groups once ready", async ({ page, isMobile }) => {
    test.skip(isMobile, "leaves through the sidebar; the scenario doesn't depend on layout");
    let personalizedReady = false;
    await page.route("**/api/watched/**", (route) => route.fulfill({ json: paginated([WATCHED]) }));
    await page.route("**/api/recommendations/for-you/**", (route) =>
      route.fulfill({ json: { status: "ready", sections: FOR_YOU } }));
    await page.route("**/api/recommendations/personalized/**", (route) =>
      route.fulfill({ json: personalizedReady
        ? { status: "ready", sections: PERSONALIZED }
        : { status: "pending", sections: [] } }));
    await page.route("**/api/recommendations/followed-people/**", (route) => route.fulfill({ json: [] }));

    await page.goto("/recommendations");
    await expect(page.getByText("Trending For You")).toBeVisible();
    await expect(page.getByText("Because you watched Fight Club")).toHaveCount(0);

    // Leave in-app, so the page's unmount saves its (incomplete) snapshot.
    await page.getByRole("menuitem", { name: /Watchlist/ }).click();
    await expect(page).toHaveURL("/watchlist");
    await expect(page.getByRole("heading", { name: /My Watchlist/ })).toBeVisible();
    personalizedReady = true;

    const repoll = page.waitForRequest((r) => r.url().includes("/api/recommendations/personalized/"));
    await page.getByRole("menuitem", { name: /For You/ }).click();
    await expect(page).toHaveURL("/recommendations");
    await repoll;
    await expect(page.getByText("Because you watched Fight Club")).toBeVisible();
    await expect(page.getByText("Trending For You")).toBeVisible();
  });

  /** Mocks for one visit-to-visit scenario; `counts` tracks requests per group. */
  async function mockForYou(page: Page, personalized: () => object | Promise<object>) {
    const counts = { forYou: 0, personalized: 0, followed: 0 };
    await page.route("**/api/watched/**", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 201, json: { ...WATCHED, id: 2, mediaId: 100, title: "Movie 1" } })
        : route.fulfill({ json: paginated([WATCHED]) }));
    await page.route("**/api/recommendations/for-you/**", (route) => {
      counts.forYou++;
      return route.fulfill({ json: { status: "ready", sections: FOR_YOU } });
    });
    await page.route("**/api/recommendations/personalized/**", async (route) => {
      counts.personalized++;
      return route.fulfill({ json: await personalized() });
    });
    await page.route("**/api/recommendations/followed-people/**", (route) => {
      counts.followed++;
      return route.fulfill({ json: [] });
    });
    return counts;
  }

  async function leaveAndReturn(page: Page) {
    await page.getByRole("menuitem", { name: /Watchlist/ }).click();
    await expect(page.getByRole("heading", { name: /My Watchlist/ })).toBeVisible();
    await page.getByRole("menuitem", { name: /For You/ }).click();
    await expect(page).toHaveURL("/recommendations");
  }

  test("polling that gives up says so, offers Retry, and isn't saved as final", async ({ page, isMobile }) => {
    test.skip(isMobile, "leaves through the sidebar; the scenario doesn't depend on layout");
    // Shrink only For You's 3 s poll interval. page.clock would also stall the
    // route exit animation (AnimatePresence mode="wait"), so time stays real.
    await page.addInitScript(() => {
      const realSetTimeout = window.setTimeout;
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
        realSetTimeout(fn, ms === 3000 ? 20 : ms, ...args)) as typeof window.setTimeout;
    });
    const counts = await mockForYou(page, () => ({ status: "pending", sections: [] }));
    await page.goto("/recommendations");
    await expect(page.getByText("Trending For You")).toBeVisible();

    const notice = page.getByText("Recommendations are taking longer than usual.");
    await expect(notice).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    // The first request (twice under dev StrictMode) plus 20 polls, then it stops.
    const stopped = counts.personalized;
    expect(stopped).toBeGreaterThanOrEqual(21);
    await page.waitForTimeout(300);
    expect(counts.personalized).toBe(stopped);

    // Not saved as final: the next visit fetches again.
    await leaveAndReturn(page);
    await expect.poll(() => counts.personalized).toBeGreaterThan(stopped);
  });

  test("leaving before the first answer keeps the snapshot incomplete", async ({ page, isMobile }) => {
    test.skip(isMobile, "leaves through the sidebar; the scenario doesn't depend on layout");
    let hold: Promise<void> | null = null;
    let release = () => {};
    const counts = await mockForYou(page, async () => {
      if (hold) await hold;
      return { status: "pending", sections: [] };
    });
    await page.goto("/recommendations");
    await expect(page.getByText("Trending For You")).toBeVisible();
    await expect.poll(() => counts.personalized).toBeGreaterThan(0);

    // Visit 2 starts from the incomplete snapshot; leave before it answers.
    hold = new Promise<void>((r) => (release = r));
    await page.getByRole("menuitem", { name: /Watchlist/ }).click();
    await expect(page.getByRole("heading", { name: /My Watchlist/ })).toBeVisible();
    let before = counts.personalized;
    await page.getByRole("menuitem", { name: /For You/ }).click();
    await expect.poll(() => counts.personalized).toBeGreaterThan(before);
    await page.getByRole("menuitem", { name: /Watchlist/ }).click();
    await expect(page.getByRole("heading", { name: /My Watchlist/ })).toBeVisible();
    release();
    hold = null;

    // Visit 3 must fetch again: nothing answered during visit 2.
    before = counts.personalized;
    await page.getByRole("menuitem", { name: /For You/ }).click();
    await expect.poll(() => counts.personalized).toBeGreaterThan(before);
  });

  test("marking a card watched doesn't refetch or reorder the groups", async ({ page }) => {
    const counts = await mockForYou(page, () => ({ status: "ready", sections: PERSONALIZED }));
    await page.goto("/recommendations");
    await expect(page.getByText("Because you watched Fight Club")).toBeVisible();
    const order = await page.locator(".ant-divider").allInnerTexts();
    const before = { ...counts };

    await page.getByRole("button", { name: "Mark as watched" }).first().click();
    await page.locator(".ant-modal").getByRole("button", { name: "Mark Watched" }).click();
    await expect(page.locator(".ant-message-success")).toContainText("Marked as watched");
    await expect(page.getByRole("button", { name: "Unmark watched" }).first()).toBeVisible();

    expect(counts).toEqual(before);
    expect(await page.locator(".ant-divider").allInnerTexts()).toEqual(order);
  });
});

test.describe("Filter drawer is a draft", () => {
  const popular = { id: 9, title: "Grid Movie", poster_path: null, backdrop_path: null, release_date: "2020-01-01", vote_average: 7, genre_ids: [18], overview: "" };

  async function openDrawer(page: Page) {
    await page.getByRole("button", { name: "Toggle filters" }).click();
    const drawer = page.locator(".ant-drawer-content").filter({ hasText: "Filter & Sort" });
    await expect(drawer).toBeVisible();
    return drawer;
  }

  test("closing without Apply discards the edits", async ({ page }) => {
    await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: tmdbPage([popular]) }));
    const urls = recordDiscover(page);
    await page.goto("/movies");
    await expect(page.getByText("Grid Movie").first()).toBeVisible();
    const before = urls.movie.length;

    let drawer = await openDrawer(page);
    await drawer.getByPlaceholder("e.g. 2010").fill("1990");
    await drawer.getByText("Action", { exact: true }).click();
    await drawer.locator(".ant-drawer-close").click();
    await expect(drawer).toBeHidden();

    drawer = await openDrawer(page);
    await expect(drawer.getByPlaceholder("e.g. 2010")).toHaveValue("");
    await expect(drawer.locator(".ant-tag-checkable", { hasText: /^Action$/ })).not.toHaveClass(/ant-tag-checkable-checked/);
    expect(urls.movie.slice(before).filter((u) => u.searchParams.has("with_genres"))).toEqual([]);
  });

  test("applying a genre sends exactly one request for it", async ({ page }) => {
    await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: tmdbPage([popular]) }));
    const urls = recordDiscover(page);
    await page.goto("/movies");
    await expect(page.getByText("Grid Movie").first()).toBeVisible();

    const drawer = await openDrawer(page);
    await drawer.getByText("Action", { exact: true }).click();
    await drawer.getByRole("button", { name: "Apply Filters" }).click();
    await expect.poll(() => urls.movie.filter((u) => u.searchParams.get("with_genres") === "28").length).toBe(1);
    // Settle, then check nothing else asked for the same page.
    await expect(page.getByText("Grid Movie").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(urls.movie.filter((u) => u.searchParams.get("with_genres") === "28")).toHaveLength(1);
  });
});

test.describe("People browser Back", () => {
  test("restores the loaded pages and scroll position", async ({ page }) => {
    const people = (p: number) => Array.from({ length: 20 }, (_, i) => ({
      id: p * 100 + i, name: `Person ${p}-${i}`, profile_path: null, known_for_department: "Acting", popularity: 1,
    }));
    // Registered first: routes are checked last-registered-first, and this
    // pattern also matches person/popular.
    await page.route("**/api/tmdb/person/*", (route) =>
      route.fulfill({ json: { id: 1, name: "Someone", biography: "", profile_path: null, combined_credits: { cast: [], crew: [] } } }));
    await page.route("**/api/tmdb/person/popular**", (route) => {
      const p = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
      return route.fulfill({ json: { results: people(p), page: p, total_pages: 10, total_results: 200 } });
    });
    await page.goto("/people");
    await expect(page.getByText("Person 1-0")).toBeVisible();
    // Load pages 2 and 3 by scrolling to the sentinel.
    for (const p of [2, 3]) {
      await expect(async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect(page.getByText(`Person ${p}-19`)).toBeAttached({ timeout: 1_000 });
      }).toPass();
    }
    const target = page.getByText("Person 3-5");
    await target.scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => window.scrollY);
    await target.click();
    await expect(page).toHaveURL(/\/person\/305$/);

    await page.goBack();
    await expect(page.getByText("Person 3-19")).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 200);
  });
});
