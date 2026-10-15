import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { UserListDTO, UserListItemDTO, WatchedEntryDTO, WatchlistEntryDTO } from "../src/types/domain";

// library-filters spec: per-list filters, and Watched / Watchlist never
// strand the user on an empty page.

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

const item = (id: number, title: string): UserListItemDTO => ({
  id, mediaId: id, mediaType: "movie", title, posterPath: null, voteAverage: 7, addedAt: "2024-01-01T10:00:00Z",
});

const LISTS = [
  { id: 1, name: "List A", description: "", createdAt: "2024-01-01T10:00:00Z",
    items: [item(11, "Star Wars"), item(12, "Alien")] },
  { id: 2, name: "List B", description: "", createdAt: "2024-01-02T10:00:00Z",
    items: [item(21, "Heat"), item(22, "Ronin")] },
] satisfies UserListDTO[];

test("two lists keep their own search", async ({ page }) => {
  await page.route("**/api/lists/**", (route) => route.fulfill({ json: paginated(LISTS) }));
  await page.goto("/lists/1");
  await expect(page.getByText("Alien")).toBeVisible();
  await page.locator("#list-detail-search").fill("star");
  await expect(page.getByText("Alien")).toHaveCount(0);
  await expect(page.getByText("Star Wars")).toBeVisible();

  // In-app navigation, so the page component stays mounted across lists.
  await page.goto("/lists");
  await page.getByRole("link", { name: "List B" }).click();
  await expect(page).toHaveURL(/\/lists\/2$/);
  await expect(page.locator("#list-detail-search")).toHaveValue("");
  await expect(page.getByText("Heat")).toBeVisible();
  await expect(page.getByText("Ronin")).toBeVisible();

  await page.goBack();
  await page.getByRole("link", { name: "List A" }).click();
  await expect(page).toHaveURL(/\/lists\/1$/);
  await expect(page.locator("#list-detail-search")).toHaveValue("star");
  await expect(page.getByText("Star Wars")).toBeVisible();
  await expect(page.getByText("Alien")).toHaveCount(0);
});

test("unmarking the only item on the last Watched page moves to the page before", async ({ page }) => {
  // 25 titles at 12 per page: page 3 holds one. Newest first, so "Title 01" is last.
  let entries: WatchedEntryDTO[] = Array.from({ length: 25 }, (_, i) => ({
    id: 100 + i, mediaId: 1000 + i, mediaType: "movie", title: `Title ${String(25 - i).padStart(2, "0")}`,
    posterPath: null, voteAverage: 7, watchedAt: new Date(Date.UTC(2024, 0, 25 - i)).toISOString(),
    watchedTz: "", originalLanguage: "en", releaseYear: 2000, runtimeMinutes: null, platform: null,
  }));
  await page.route("**/api/watched/**", (route) => {
    if (route.request().method() === "DELETE") {
      const dbId = Number(route.request().url().match(/\/watched\/(\d+)\//)![1]);
      entries = entries.filter((e) => e.id !== dbId);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ json: paginated(entries) });
  });
  await page.goto("/watched?page=3&pageSize=12");
  await expect(page.getByText("Title 01")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as unwatched" })).toHaveCount(1);

  // A plain click (or tap) on Confirm: the icon's tooltip no longer covers it
  // (write-feedback "Confirmation buttons are never covered").
  await page.getByRole("button", { name: "Mark as unwatched" }).click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Mark Unwatched" }).click();

  await expect(page.getByText("Title 13")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as unwatched" })).toHaveCount(12);
  await expect(page.getByText("Title 01")).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
});

test("a long Watchlist pages, and removing the last item on the last page moves back", async ({ page }) => {
  // 50 titles at the default 48 per page: page 2 holds two. Newest first.
  let entries: WatchlistEntryDTO[] = Array.from({ length: 50 }, (_, i) => ({
    id: 200 + i, mediaId: 2000 + i, mediaType: "movie", title: `Pick ${String(50 - i).padStart(2, "0")}`,
    posterPath: null, voteAverage: 7, addedAt: new Date(Date.UTC(2024, 0, 1) + (50 - i) * 3600_000).toISOString(),
  }));
  await page.route("**/api/watchlist/**", (route) => {
    if (route.request().method() === "DELETE") {
      const dbId = Number(route.request().url().match(/\/watchlist\/(\d+)\//)![1]);
      entries = entries.filter((e) => e.id !== dbId);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ json: paginated(entries) });
  });
  await page.goto("/watchlist");
  await expect(page.getByText("Pick 50")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove from watchlist:/ })).toHaveCount(48);
  await expect(page.getByText("50 titles")).toBeVisible();

  await page.goto("/watchlist?page=2");
  await expect(page.getByRole("button", { name: /^Remove from watchlist:/ })).toHaveCount(2);
  for (const title of ["Pick 02", "Pick 01"]) {
    await page.getByRole("button", { name: `Remove from watchlist: ${title}` }).click();
    await page.locator(".ant-popconfirm").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  }

  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect(page.getByText("Pick 50")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove from watchlist:/ })).toHaveCount(48);
});

test("a list that doesn't exist shows the not-found state, and a failed load offers Retry", async ({ page }) => {
  let fail = false;
  await page.route("**/api/lists/**", (route) =>
    fail ? route.fulfill({ status: 500, json: { detail: "boom" } }) : route.fulfill({ json: paginated(LISTS) }));
  await page.goto("/lists/999");
  await expect(page.getByText("List not found")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);

  fail = true;
  await page.goto("/lists/999");
  await expect(page.getByText("Couldn't load your lists")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
