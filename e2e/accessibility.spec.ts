import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated } from "./fixtures";

// accessibility spec: Calendar release cards are real links (modifier click
// opens a new tab), and a focused card link shows its outline in light theme.

// Two days out stays inside the Calendar's window whatever the runner's zone.
const releaseDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const UPCOMING = {
  id: 4242, title: "Upcoming Film", overview: "", poster_path: null, backdrop_path: null,
  release_date: releaseDate, vote_average: 7, vote_count: 10, genre_ids: [18], popularity: 50,
  adult: false, original_language: "en", original_title: "Upcoming Film", video: false,
};

async function mockCalendar(page: Page) {
  await page.route("**/api/tmdb/discover/movie**", (route) =>
    route.fulfill({ json: { results: [UPCOMING], page: 1, total_pages: 1, total_results: 1 } })
  );
  await page.route("**/api/tmdb/discover/tv**", (route) =>
    route.fulfill({ json: { results: [], page: 1, total_pages: 1, total_results: 0 } })
  );
}

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
  await mockCalendar(page);
});

test("Ctrl/Cmd-click on a Calendar card opens the title in a new tab", async ({ page, context }) => {
  await page.goto("/calendar");
  const card = page.getByRole("link", { name: "Upcoming Film" });
  await expect(card).toHaveAttribute("href", "/movie/4242");

  const [newTab] = await Promise.all([
    context.waitForEvent("page"),
    card.click({ modifiers: ["ControlOrMeta"] }),
  ]);
  await newTab.waitForURL(/\/movie\/4242$/);
  await expect(page).toHaveURL(/\/calendar$/); // the current page stays put
});

test("a keyboard-focused card link shows a visible outline in light theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cinedb_theme", JSON.stringify("light")));
  await page.goto("/calendar");
  await expect(page.locator("body")).not.toHaveClass(/dark-theme/);
  const card = page.getByRole("link", { name: "Upcoming Film" });
  await expect(card).toBeVisible();

  // Real keyboard focus (so :focus-visible applies), not element.focus().
  let focused = false;
  for (let i = 0; i < 80 && !focused; i++) {
    await page.keyboard.press("Tab");
    focused = await card.evaluate((el) => el === document.activeElement);
  }
  expect(focused, "Tab never reached the Calendar card").toBe(true);

  const outline = await card.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
  // Not white/transparent, which would vanish on the light background.
  expect(outline.color).not.toMatch(/rgba?\(255, 255, 255|rgba\(\d+, \d+, \d+, 0\)/);
});

/** Tab until `target` has focus (real keyboard focus, bounded). */
async function tabTo(page: Page, target: import("@playwright/test").Locator) {
  for (let i = 0; i < 120; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the target");
}

test.describe("account controls and converted cards", () => {
  test("desktop: Tab to the avatar, Enter opens the profile dialog", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar avatar is a desktop/tablet control");
    await page.route("**/api/tmdb-auth/status/**", (r) => r.fulfill({ json: { connected: false } }));
    await page.goto("/watchlist");
    const avatar = page.getByRole("button", { name: "Edit profile" });
    await tabTo(page, avatar);
    await page.keyboard.press("Enter");
    await expect(page.locator(".ant-modal").getByText("Edit Profile")).toBeVisible();
  });

  test("the sidebar Sign Out button is named", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar is hidden on phones");
    await page.goto("/watchlist");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("Lists: Tab to a list and press Enter to open it", async ({ page }) => {
    const list = { id: 5, name: "Faves", description: "", createdAt: "2026-10-01T10:00:00Z", items: [] };
    await page.route("**/api/lists/**", (r) =>
      r.request().url().includes("/lists/5/") ? r.fulfill({ json: list }) : r.fulfill({ json: paginated([list]) })
    );
    await page.goto("/lists");
    const link = page.getByRole("link", { name: "Faves" });
    await tabTo(page, link);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/lists\/5$/);
  });

  test("Search: Ctrl/Cmd-click a result opens it in a new tab", async ({ page, context }) => {
    await page.route("**/api/tmdb/search/movie**", (r) =>
      r.fulfill({ json: { results: [{ ...UPCOMING, id: 550, title: "Fight Club" }], page: 1, total_pages: 1, total_results: 1 } })
    );
    await page.goto("/search?q=fight");
    const card = page.getByRole("link", { name: "Fight Club" });
    const [newTab] = await Promise.all([context.waitForEvent("page"), card.click({ modifiers: ["ControlOrMeta"] })]);
    await newTab.waitForURL(/\/movie\/550$/);
    await expect(page).toHaveURL(/\/search\?q=fight$/);
  });

  test("Recommendations: Ctrl/Cmd-click a card opens it in a new tab", async ({ page, context }) => {
    const section = { key: "s", label: "Because you watched", items: [{ id: 550, type: "movie", title: "Fight Club", posterPath: null, voteAverage: 8.4 }] };
    await page.route("**/api/recommendations/for-you/**", (r) => r.fulfill({ json: { status: "ready", sections: [section] } }));
    await page.route("**/api/recommendations/personalized/**", (r) => r.fulfill({ json: { status: "ready", sections: [] } }));
    await page.route("**/api/recommendations/followed-people/**", (r) => r.fulfill({ json: [] }));
    // The page shows its "watch something first" prompt for an empty history.
    await page.route("**/api/watched/**", (r) => r.fulfill({ json: paginated([{
      id: 1, mediaId: 13, mediaType: "movie", title: "Forrest Gump", posterPath: null, voteAverage: 8.5,
      watchedAt: "2026-10-01T10:00:00Z", watchedTz: "", originalLanguage: "en", releaseYear: 1994,
      runtimeMinutes: 142, platform: null,
    }]) }));
    await page.goto("/recommendations");
    const card = page.getByRole("link", { name: "Fight Club" }).first();
    const [newTab] = await Promise.all([context.waitForEvent("page"), card.click({ modifiers: ["ControlOrMeta"] })]);
    await newTab.waitForURL(/\/movie\/550$/);
    await expect(page).toHaveURL(/\/recommendations$/);
  });
});
