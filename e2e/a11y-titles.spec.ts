import { test, expect, mockAuthedBase, movieDetail, paginated } from "./fixtures";
import type { WatchlistEntryDTO } from "../src/types/domain";

// accessibility spec (a11y-motion-titles): page titles and announced
// navigation, navigation entries as links, card buttons named by title,
// password fields that declare their purpose, and reduced motion.

const FIGHT_CLUB = {
  id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club",
  posterPath: null, voteAverage: 8.4, addedAt: "2024-01-15T10:00:00Z",
} satisfies WatchlistEntryDTO;

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

test("each page has its own tab title; a movie page uses the movie's name", async ({ page }) => {
  await page.goto("/watchlist");
  await expect(page).toHaveTitle("Watchlist · CINE DB");
  await page.route("**/api/tmdb/movie/550**", (r) => r.fulfill({ json: movieDetail({ id: 550, title: "Fight Club" }) }));
  await page.goto("/movie/550");
  await expect(page).toHaveTitle("Fight Club · CINE DB");
});

test("a library card's buttons name their title", async ({ page }) => {
  await page.route("**/api/watchlist/**", (r) => r.fulfill({ json: paginated([FIGHT_CLUB]) }));
  await page.goto("/watchlist");
  await expect(page.getByRole("button", { name: "Remove from watchlist: Fight Club", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark watched: Fight Club", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate: Fight Club", exact: true })).toBeVisible();
});

test.describe("desktop sidebar", () => {
  test.skip(({ isMobile }) => isMobile, "the sidebar is hidden on phones");

  test("entries are links; a plain click routes in-app once and is announced", async ({ page }) => {
    await page.goto("/watchlist");
    const stats = page.locator(".app-sidebar").getByRole("link", { name: "Stats" });
    await expect(stats).toHaveAttribute("href", "/stats");
    const before = await page.evaluate(() => window.history.length);
    await page.locator(".app-sidebar").getByRole("link", { name: "Watched" }).click();
    await expect(page).toHaveURL(/\/watched$/);
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    await expect(page.getByRole("status").filter({ hasText: "CINE DB" })).toHaveText("Watched · CINE DB");
  });

  test("profile password fields declare their purpose", async ({ page }) => {
    await page.route("**/api/tmdb-auth/status/**", (r) => r.fulfill({ json: { connected: false } }));
    await page.goto("/watchlist");
    await page.getByRole("button", { name: "Edit profile" }).click();
    const modal = page.locator(".ant-modal");
    await expect(modal.getByLabel("Current Password")).toHaveAttribute("autocomplete", "current-password");
    await expect(modal.getByPlaceholder("New password")).toHaveAttribute("autocomplete", "new-password");
    await expect(modal.getByPlaceholder("Confirm")).toHaveAttribute("autocomplete", "new-password");
  });
});

test.describe("phone bottom nav", () => {
  test.skip(({ isMobile }) => !isMobile, "the bottom nav shows on phones");

  test("core entries are links", async ({ page }) => {
    await page.goto("/movies");
    await expect(page.locator(".app-bottom-nav").getByRole("link", { name: "Watchlist" })).toHaveAttribute("href", "/watchlist");
  });
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("CSS transitions finish at once", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page).toHaveTitle("Watchlist · CINE DB");
    const duration = await page.evaluate(() => getComputedStyle(document.body).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});
