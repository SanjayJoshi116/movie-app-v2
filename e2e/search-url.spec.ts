import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase } from "./fixtures";

// view-state-restore spec: a search is addressable by URL (term + tab).

const page1 = (results: unknown[]) => ({ results, page: 1, total_pages: 1, total_results: results.length });

async function mockSearch(page: Page) {
  await page.route("**/api/tmdb/search/person**", (r) => {
    const q = new URL(r.request().url()).searchParams.get("query");
    return r.fulfill({ json: page1([{ id: 525, name: `Person for ${q}`, profile_path: null, known_for_department: "Directing", popularity: 9 }]) });
  });
  await page.route("**/api/tmdb/search/tv**", (r) => {
    const q = new URL(r.request().url()).searchParams.get("query");
    return r.fulfill({ json: page1([{ id: 1396, name: `Show for ${q}`, first_air_date: "2008-01-20", poster_path: null, vote_average: 9, genre_ids: [] }]) });
  });
  await page.route("**/api/tmdb/search/movie**", (r) => r.fulfill({ json: page1([]) }));
}

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
  await mockSearch(page);
});

test("reloading a search URL shows the same results and tab", async ({ page }) => {
  await page.goto("/search?q=nolan&tab=people");
  await expect(page.locator(".ant-tabs-tab-active")).toHaveText("People");
  await expect(page.getByText("Person for nolan")).toBeVisible();

  await page.reload();
  await expect(page.locator(".ant-tabs-tab-active")).toHaveText("People");
  await expect(page.getByText("Person for nolan")).toBeVisible();
});

test("a new search from the TV tab stays on the TV tab", async ({ page }, testInfo) => {
  await page.goto("/search?q=breaking&tab=tv");
  await expect(page.getByText("Show for breaking")).toBeVisible();

  if (testInfo.project.name === "mobile-chrome") {
    await page.locator(".app-bottom-nav").getByRole("button", { name: "Search" }).click();
  }
  const box = page.getByPlaceholder(/search/i).filter({ visible: true });
  await box.fill("better call");
  await box.press("Enter");

  await expect(page).toHaveURL("/search?q=better+call&tab=tv");
  await expect(page.locator(".ant-tabs-tab-active")).toHaveText("TV Shows");
  await expect(page.getByText("Show for better call")).toBeVisible();
});
