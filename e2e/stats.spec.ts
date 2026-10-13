import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase } from "./fixtures";
import type { StatsData } from "../src/api/userApi";

/** Local yyyy-mm-dd, `daysAgo` before today (the heatmap ends on the device's today). */
function localDay(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dmy = (iso: string) => iso.split("-").reverse().join("-");

function stats(overrides: Partial<StatsData> = {}): StatsData {
  return {
    totalWatched: 3, moviesCount: 3, tvCount: 0, totalRatings: 3, avgUserRating: 7.3, avgTmdbRating: 7.5,
    ratingDistribution: Array.from({ length: 10 }, (_, i) => ({ rating: String(i + 1), count: i === 6 ? 2 : 0 })),
    monthlyActivity: [{ month: "Jan 2026", count: 1 }, { month: "Feb 2026", count: 0 }, { month: "Mar 2026", count: 2 }],
    topGenres: [{ genre: "Drama", count: 3 }],
    languageBreakdown: [], decadeBreakdown: [],
    dailyActivity: [{ date: localDay(1), count: 2 }],
    topRatedItems: [], recentItems: [], totalRuntimeMinutes: 0, platformBreakdown: [],
    ratingByGenre: [{ genre: "Drama", avgRating: 7.3 }],
    reviewsWritten: 0, listsCount: 0, listsItemsCount: 0, watchlistTotal: 0, watchlistUnwatched: 0,
    ...overrides,
  };
}

async function openStats(page: Page, data: StatsData) {
  await mockAuthedBase(page);
  await page.route("**/api/stats/**", (route) => route.fulfill({ json: data }));
  await page.goto("/stats");
}

const card = (page: Page, title: string) => page.locator(".ant-card").filter({ hasText: title });
const bubble = (page: Page) => page.locator("body > div").filter({ hasText: / — \d+ items?$/ });

test("Rating by Genre tooltip says Avg rating, not the field name", async ({ page }) => {
  await openStats(page, stats());
  const bar = card(page, "Rating by Genre").locator(".recharts-bar-rectangle").first();
  await bar.hover();
  await expect(page.getByText("7.3 Avg rating")).toBeVisible();
  await expect(page.getByText(/avgRating/)).toHaveCount(0);
});

test("the heatmap is one tab stop read with the arrow keys", async ({ page }) => {
  await openStats(page, stats());
  const grid = page.getByRole("group", { name: /Watch activity by day/ });
  await grid.focus();
  // Focus starts on today; Up is the previous day (rows are weekdays).
  await expect(bubble(page)).toHaveText(`${dmy(localDay(0))} — 0 items`);
  await page.keyboard.press("ArrowUp");
  await expect(bubble(page)).toHaveText(`${dmy(localDay(1))} — 2 items`);
  await expect(page.locator("#heatmap-active-day")).toHaveText(`${dmy(localDay(1))} — 2 items`);
  await page.keyboard.press("ArrowLeft");
  await expect(bubble(page)).toHaveText(`${dmy(localDay(8))} — 0 items`);
  await page.keyboard.press("ArrowRight");
  await expect(bubble(page)).toHaveText(`${dmy(localDay(1))} — 2 items`);
  // A week past yesterday is in the future: clamped to today.
  await page.keyboard.press("ArrowRight");
  await expect(bubble(page)).toHaveText(`${dmy(localDay(0))} — 0 items`);

  await page.keyboard.press("Tab");
  await expect(grid).not.toBeFocused();
  await expect(bubble(page)).toHaveCount(0);
});

test("the heatmap explains it counts watches", async ({ page, isMobile }) => {
  await openStats(page, stats());
  const info = card(page, "Activity Heatmap").locator(".anticon-info-circle").first();
  // Phones have no hover: a tap opens the tooltip there.
  if (isMobile) await info.tap();
  else await info.hover();
  await expect(page.getByText("Counts the titles you marked watched each day.")).toBeVisible();
});

test("Top Genres without genre data says they're being looked up", async ({ page }) => {
  await openStats(page, stats({ topGenres: [] }));
  await expect(card(page, "Top Genres")).toContainText("Genres are still being looked up");
  await expect(card(page, "Top Genres").getByRole("link")).toHaveCount(0);
});

test("a month with no watches is plotted, not skipped", async ({ page }) => {
  await openStats(page, stats());
  const chart = card(page, "Watch Activity by Month");
  await expect(chart.locator(".recharts-cartesian-axis-tick-value").filter({ hasText: "Feb 2026" })).toBeVisible();
});
