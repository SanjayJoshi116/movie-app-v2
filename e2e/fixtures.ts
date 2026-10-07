import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared e2e fixtures. Specs import `test`/`expect` from here, not from
 * "@playwright/test", so every test gets the `unmocked` catch-all.
 *
 * Playwright checks routes last-registered-first. The catch-all is registered
 * before the test body runs, so any `page.route()` a test or `mockAuthedBase`
 * adds wins over it.
 */

export const MOCK_USER = { id: 1, username: "testuser", email: "t@t.com", first_name: "", last_name: "" };
const MOCK_TOKENS = { access: "fake-access", refresh: "fake-refresh" };

const EMPTY_TMDB_PAGE = { results: [], total_pages: 1, total_results: 0, page: 1 };

/** The real list-endpoint response shape (DRF pagination), not a bare array. */
export function paginated<T>(items: T[]) {
  return { count: items.length, next: null, previous: null, results: items };
}

export const test = base.extend<{ unmocked: string[] }>({
  unmocked: [
    async ({ page }, use) => {
      const urls: string[] = [];
      await page.route("**/api/**", (route) => {
        const url = route.request().url();
        // Decorative TMDB calls (hero banner, providers...) get an empty page
        // rather than failing every test that doesn't care about them.
        if (url.includes("/api/tmdb/")) return route.fulfill({ json: EMPTY_TMDB_PAGE });
        urls.push(`${route.request().method()} ${url}`);
        return route.fulfill({ status: 501, json: { detail: `unmocked: ${url}` } });
      });
      await use(urls);
      expect(urls, `Unmocked app API calls (add a page.route for each):\n${urls.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Seed a signed-in session in localStorage before the app boots. */
export async function seedAuth(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
  }, { ...MOCK_TOKENS, user: MOCK_USER });
}

/**
 * Every API call the app makes on any authenticated page. Trailing `**`
 * matters: fetchAllPages() always appends `?page=N`.
 */
export async function mockAppApi(page: Page) {
  for (const path of ["watchlist", "watched", "ratings", "lists", "followed-people"]) {
    await page.route(`**/api/${path}/**`, (route) => route.fulfill({ json: paginated([]) }));
  }
  await page.route("**/api/notifications/new-releases/**", (route) =>
    route.fulfill({ json: { items: [], unreadCount: 0 } })
  );
  await page.route("**/api/notifications/mark-seen/**", (route) => route.fulfill({ status: 204, body: "" }));
}

/** Signed-in session plus `mockAppApi`. */
export async function mockAuthedBase(page: Page) {
  await seedAuth(page);
  await mockAppApi(page);
}
