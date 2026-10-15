import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { UserListDTO } from "../src/types/domain";

// browse-filters: searches stay on the page they were made on. routing: the
// navigation highlights the section a page belongs to.

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

const tmdbPage = (results: object[]) => ({ results, page: 1, total_pages: 1, total_results: results.length });
const person = (id: number, name: string) => ({ id, name, profile_path: null, known_for_department: "Acting", popularity: 1 });
const movie = { id: 11, title: "Grid Movie", poster_path: null, backdrop_path: null, release_date: "2020-01-01", vote_average: 7, genre_ids: [18], overview: "" };

async function mockPeople(page: Page) {
  // Registered first: routes are checked last-registered-first, and this
  // pattern also matches person/popular.
  await page.route("**/api/tmdb/person/*", (route) =>
    route.fulfill({ json: { id: 7, name: "Chris N", biography: "", profile_path: null, known_for_department: "Directing" } }));
  await page.route("**/api/tmdb/person/popular**", (route) => route.fulfill({ json: tmdbPage([person(1, "Popular Person")]) }));
  await page.route("**/api/tmdb/search/person**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("query");
    return route.fulfill({ json: tmdbPage([person(7, `Found ${q}`)]) });
  });
}

test.describe("desktop sidebar", () => {
  test.skip(({ isMobile }) => isMobile, "the sidebar search box is desktop/tablet only");

  test("a global search doesn't carry into People", async ({ page }) => {
    await mockPeople(page);
    await page.route("**/api/tmdb/search/**", (route) => route.fulfill({ json: tmdbPage([]) }));
    await page.goto("/movies");
    await page.locator("#global-search").fill("batman");
    await page.locator("#global-search").press("Enter");
    await expect(page).toHaveURL(/\/search\?q=batman/);

    await page.getByRole("menuitem", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "Popular People" })).toBeVisible();
    await expect(page.getByText("Popular Person")).toBeVisible();
    await expect(page.locator("#people-search")).toHaveValue("");
  });

  test("a People search lives in its URL, not the sidebar box", async ({ page }) => {
    await mockPeople(page);
    await page.goto("/people");
    await page.locator("#people-search").fill("nolan");
    await page.locator("#people-search").press("Enter");
    await expect(page).toHaveURL(/\/people\?q=nolan$/);
    await expect(page.getByText("Found nolan")).toBeVisible();
    await expect(page.locator("#global-search")).toHaveValue("");

    // Back from a person returns to the same search.
    await page.getByText("Found nolan").click();
    await expect(page).toHaveURL(/\/person\/7$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/people\?q=nolan$/);
    await expect(page.getByText("Found nolan")).toBeVisible();
  });

  test("Movies never comes back in a search mode", async ({ page }) => {
    await page.route("**/api/tmdb/discover/movie**", (route) => route.fulfill({ json: tmdbPage([movie]) }));
    await page.route("**/api/tmdb/search/**", (route) => route.fulfill({ json: tmdbPage([]) }));
    await page.goto("/movies");
    await expect(page.getByText("Grid Movie").first()).toBeVisible();
    await page.getByRole("link", { name: /Grid Movie/ }).first().click();
    await expect(page).toHaveURL(/\/movie\/11$/);
    await page.locator("#global-search").fill("batman");
    await page.locator("#global-search").press("Enter");
    await expect(page).toHaveURL(/\/search\?q=batman/);

    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/\/movies$/);
    await expect(page.getByText("Grid Movie").first()).toBeVisible();
    await expect(page.getByText(/disabled during search/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Now Playing" })).toBeEnabled();
  });

  test("a list page highlights My Lists", async ({ page }) => {
    const list = { id: 3, name: "Weekend", description: "", items: [], createdAt: "2026-01-01T00:00:00Z" } satisfies UserListDTO;
    await page.route("**/api/lists/**", (route) => route.fulfill({ json: paginated([list]) }));
    await page.goto("/lists/3");
    await expect(page.getByRole("heading", { name: "Weekend" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "My Lists" })).toHaveClass(/ant-menu-item-selected/);
    await expect(page.locator(".ant-menu-item-selected")).toHaveCount(1);
  });
});
