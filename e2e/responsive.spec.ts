import { test, expect, mockAuthedBase } from "./fixtures";

// Unmocked TMDB calls get an empty page from the fixtures' catch-all; any
// unmocked app API call fails the test (see e2e/fixtures.ts).

test.describe("Responsive layout", () => {
  test("phone width: sidebar hidden, bottom nav visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockAuthedBase(page);
    await page.goto("/movies");

    await expect(page.locator(".app-sidebar")).not.toBeVisible();
    await expect(page.locator(".app-bottom-nav")).toBeVisible();
  });

  test("tablet width: sidebar collapses to icon rail", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await mockAuthedBase(page);
    await page.goto("/movies");

    const sidebar = page.locator(".app-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator(".ant-menu").first()).toBeVisible();

    const width = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThan(100);

    await expect(sidebar.locator(".ant-menu-title-content").first()).not.toBeVisible();
    await expect(page.locator(".app-bottom-nav")).not.toBeVisible();
  });

  test("desktop width: full sidebar with labels", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAuthedBase(page);
    await page.goto("/movies");

    const sidebar = page.locator(".app-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator(".ant-menu").first()).toBeVisible();

    const width = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(200);

    await expect(sidebar.locator(".ant-menu-title-content").first()).toBeVisible();
    await expect(page.locator(".app-bottom-nav")).not.toBeVisible();
  });

  test("narrow phone: login card doesn't overflow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
    await page.route("**/api/tmdb/**", (route) => route.fulfill({ json: { results: [], total_pages: 1, total_results: 0 } }));

    await page.goto("/login");
    const card = page.locator(".ant-card").first();
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(320);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);
  });

  test("very narrow phone: bottom nav doesn't overflow or clip", async ({ page }) => {
    await page.setViewportSize({ width: 340, height: 700 });
    await mockAuthedBase(page);
    await page.goto("/movies");

    await expect(page.locator(".app-bottom-nav")).toBeVisible();

    const overflowing = await page.evaluate(() => {
      const nav = document.querySelector(".app-bottom-nav");
      if (!nav) return true;
      const navRight = nav.getBoundingClientRect().right;
      return Array.from(nav.querySelectorAll(".bottom-nav-btn")).some(
        (btn) => btn.getBoundingClientRect().right > navRight + 1
      );
    });
    expect(overflowing).toBe(false);

    const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasPageOverflow).toBe(false);
  });
});
