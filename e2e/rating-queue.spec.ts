import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { RatingEntryDTO, WatchedEntryDTO } from "../src/types/domain";

// rating-queue spec: rate watched titles without a rating, one tap each.

const watched = (id: number, title: string, day: number): WatchedEntryDTO => ({
  id, mediaId: 1000 + id, mediaType: "movie", title, posterPath: null, voteAverage: 7,
  watchedAt: new Date(Date.UTC(2026, 0, day, 12)).toISOString(), watchedTz: "UTC",
  originalLanguage: "en", releaseYear: 2000, runtimeMinutes: null, platform: null,
});

// Newest watched first: Dune, Heat, Alien.
const HISTORY = [watched(1, "Alien", 1), watched(2, "Dune", 3), watched(3, "Heat", 2)];

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
  await page.route("**/api/watched/**", (route) => route.fulfill({ json: paginated(HISTORY) }));
});

test("rate the backlog from Watched: tap, key, skip, undo, done", async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  let nextId = 50;
  await page.route("**/api/ratings/**", (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const body = req.postDataJSON() as { mediaId: number; mediaType: "movie"; title: string; userRating: number };
      posts.push(body);
      const dto: RatingEntryDTO = { id: nextId++, ...body, review: "", ratedAt: "2026-11-03T10:00:00Z" };
      return route.fulfill({ status: 201, json: dto });
    }
    if (req.method() === "DELETE") {
      deletes.push(new URL(req.url()).pathname);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ json: paginated([]) });
  });

  await page.goto("/watched");
  await expect(page.getByText("3 watched titles aren't rated")).toBeVisible();
  await page.getByRole("link", { name: "Rate them" }).click();
  await expect(page).toHaveURL(/\/watched\/rate$/);
  await expect(page).toHaveTitle(/Rate Watched Titles/);

  const current = page.locator("#rate-queue-current");
  await expect(current).toHaveText("Dune (2000)");
  await page.getByRole("button", { name: "Rate Dune 8 out of 10" }).click();
  await expect(current).toHaveText("Heat (2000)");
  await expect(page.getByText("1 rated · 2 left")).toBeVisible();

  await page.getByRole("button", { name: "Skip" }).click();
  await expect(current).toHaveText("Alien (2000)");
  await page.keyboard.press("0");
  await expect(current).toHaveText("Heat (2000)");
  await expect(page.getByText("2 rated · 1 left")).toBeVisible();

  await page.getByRole("button", { name: "Undo last rating" }).click();
  await expect(current).toHaveText("Alien (2000)");
  expect(deletes).toEqual(["/api/ratings/51/"]);

  await page.keyboard.press("7");
  await expect(current).toHaveText("Heat (2000)");
  await page.getByRole("button", { name: "Rate Heat 6 out of 10" }).click();
  await expect(page.getByText("All caught up")).toBeVisible();

  expect(posts.map((p) => [p.mediaId, p.userRating])).toEqual([[1002, 8], [1001, 10], [1001, 7], [1003, 6]]);
  expect(posts[0]).toMatchObject({ mediaType: "movie", title: "Dune" });
});

test("a failed save puts the title back with an error", async ({ page }) => {
  await page.route("**/api/ratings/**", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 500, contentType: "text/html", body: "<h1>Server Error</h1>" });
    return route.fulfill({ json: paginated([]) });
  });
  await page.goto("/watched/rate");
  const current = page.locator("#rate-queue-current");
  await expect(current).toHaveText("Dune (2000)");
  await page.getByRole("button", { name: "Rate Dune 9 out of 10" }).click();
  await expect(page.getByText(/Couldn't save the rating for Dune/)).toBeVisible();
  await expect(current).toHaveText("Dune (2000)");
  await expect(page.getByText("0 rated · 3 left")).toBeVisible();
});

test("the rate page highlights Watched in the sidebar", async ({ page }, testInfo) => {
  // Phones have no sidebar; the highlight rule itself is unit-tested in navSection.test.ts.
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar only");
  await page.route("**/api/ratings/**", (route) => route.fulfill({ json: paginated([]) }));
  await page.goto("/watched/rate");
  await expect(page.locator("#rate-queue-current")).toHaveText("Dune (2000)");
  await expect(page.getByRole("menuitem", { name: "Watched" })).toHaveClass(/ant-menu-item-selected/);
  await expect(page.locator(".ant-menu-item-selected")).toHaveCount(1);
});
