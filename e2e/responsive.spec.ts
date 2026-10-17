import { test, expect, mockAuthedBase, movieDetail } from "./fixtures";

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

  // The short sizes stand in for a phone with the keyboard up: on account pages
  // the keyboard shrinks the page to the space above it (resizes-content).
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [412, 480], [390, 440], [375, 330]] as const) {
    test(`phone ${width}x${height}: the sign-in page doesn't scroll vertically (login-page)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
      await page.goto("/login");
      await expect(page.locator(".auth-screen")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
      // The page heading stays for screen readers even when the header is hidden visually.
      await expect(page.getByRole("heading", { level: 1, name: "CINE DB" })).toBeAttached();
    });
  }

  test("the keyboard shrinks the page only on account pages (login-page)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockAuthedBase(page);
    const viewportMeta = () => page.evaluate(() => document.querySelector('meta[name="viewport"]')!.getAttribute("content"));
    await page.goto("/reset-password/abc123/token456");
    await expect(page.locator(".auth-screen")).toBeVisible();
    expect(await viewportMeta()).toContain("interactive-widget=resizes-content");
    await page.locator(".app-sidebar").getByRole("link", { name: "Watchlist" }).first().click();
    await expect(page).toHaveURL(/\/watchlist/);
    expect(await viewportMeta()).toBe("width=device-width, initial-scale=1");
  });

  for (const path of ["/movies", "/tv", "/anime"]) {
    test(`1366x768: the sidebar has no scrollbar of its own on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await mockAuthedBase(page);
      await page.goto(path);
      const sidebar = page.locator(".app-sidebar");
      await expect(sidebar.getByRole("heading", { name: "CINE DB" })).toBeVisible();
      const { scroll, client } = await sidebar.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }

  for (const c of [
    { name: "signed out", path: "/register", authed: false },
    { name: "signed out", path: "/forgot-password", authed: false },
    { name: "signed out", path: "/reset-password/abc123/token456", authed: false },
  ]) {
    test(`narrow phone, ${c.name}: ${c.path} card fits and clears the bottom nav (auth-pages)`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      if (c.authed) {
        await mockAuthedBase(page);
      } else {
        await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
      }
      await page.goto(c.path);
      const card = page.locator(".auth-screen");
      await expect(card).toBeVisible();
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }

  test("narrow phone, signed in: the reset card's button clears the bottom nav (auth-pages)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await mockAuthedBase(page);
    await page.goto("/reset-password/abc123/token456");
    const button = page.locator(".auth-screen").getByRole("button", { name: "Reset Password" });
    await expect(button).toBeVisible();
    // Scrolled to the bottom, the card's last control sits above the bottom nav.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const nav = (await page.locator(".app-bottom-nav").boundingBox())!;
    const last = (await button.boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(nav.y);
  });

  const popupCases = [
    { name: "desktop sidebar", width: 1366, height: 768, collapsed: false, path: "/movies" },
    { name: "desktop collapsed rail", width: 1366, height: 768, collapsed: true, path: "/movies" },
    { name: "tablet rail", width: 800, height: 1024, collapsed: false, path: "/movies" },
    { name: "tablet rail, non-browse page", width: 800, height: 1024, collapsed: false, path: "/watchlist" },
    { name: "phone bottom nav", width: 375, height: 812, collapsed: false, path: "/movies" },
    { name: "narrow phone, non-browse page", width: 320, height: 640, collapsed: false, path: "/watchlist" },
    { name: "narrow phone, browse page", width: 320, height: 640, collapsed: false, path: "/movies" },
  ];
  for (const c of popupCases) {
    test(`notification popup stays on-screen and anchored: ${c.name}`, async ({ page }) => {
      await page.setViewportSize({ width: c.width, height: c.height });
      if (c.collapsed) {
        await page.addInitScript(() => localStorage.setItem("cinedb_sidebar_collapsed", JSON.stringify(true)));
      }
      await mockAuthedBase(page);
      await page.goto(c.path);

      const bell = page.locator('button[aria-label="Notifications"]:visible');
      await bell.click();
      const popup = page.locator(".ant-dropdown:not(.ant-dropdown-hidden)");
      await expect(popup).toBeVisible();
      // Wait out antd's open animation: the box is final once two reads agree.
      const settled = async () => {
        let prev = "";
        for (;;) {
          const box = await popup.boundingBox();
          const cur = JSON.stringify(box);
          if (box && cur === prev) return box;
          prev = cur;
          await page.waitForTimeout(100);
        }
      };
      const box = await settled();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(c.width);
      expect(box.y + box.height).toBeLessThanOrEqual(c.height);

      // Popup keeps its offset from the bell when the page scrolls.
      const offset = async () => {
        const [p, b] = [await popup.boundingBox(), await bell.boundingBox()];
        return { dx: p!.x - b!.x, dy: p!.y - b!.y };
      };
      const before = await offset();
      // Resolves once the scroll event has fired and two frames have passed,
      // so antd's scroll-driven reposition (done in a frame) has already run.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const spacer = document.createElement("div");
            spacer.style.height = "3000px";
            document.querySelector(".app-content")?.appendChild(spacer);
            window.addEventListener(
              "scroll",
              () => requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              { once: true },
            );
            window.scrollBy(0, 600);
          }),
      );
      expect(await offset()).toEqual(before);
    });
  }

  test("phone: bottom-nav Filters opens the filter panel and applies", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAuthedBase(page);
    await page.goto("/movies");

    const toggle = page.locator('.app-bottom-nav button[aria-label="Toggle filters"]');
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    const drawer = page.locator(".ant-drawer-content").filter({ hasText: "Filter & Sort" });
    await expect(drawer).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await drawer.getByText("Action", { exact: true }).click();
    const discover = page.waitForRequest((r) => r.url().includes("/api/tmdb/discover/movie") && r.url().includes("with_genres=28"));
    await drawer.getByRole("button", { name: "Apply Filters" }).click();
    await discover;
    await expect(drawer).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  for (const path of ["/tv", "/anime"]) {
    test(`phone: bottom-nav Filters shown on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockAuthedBase(page);
      await page.goto(path);
      await page.locator('.app-bottom-nav button[aria-label="Toggle filters"]').click();
      await expect(page.locator(".ant-drawer-content").filter({ hasText: "Filter & Sort" })).toBeVisible();
    });
  }

  test("phone: no Filters button off browse pages", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAuthedBase(page);
    await page.goto("/watchlist");
    await expect(page.locator(".app-bottom-nav")).toBeVisible();
    await expect(page.locator('.app-bottom-nav button[aria-label="Toggle filters"]')).toHaveCount(0);
  });

  test("phone: opening the Search drawer adds no duplicate id", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAuthedBase(page);
    await page.goto("/movies");
    await page.locator(".app-bottom-nav").getByRole("button", { name: "Search" }).click();
    await expect(page.locator("#mobile-search")).toBeVisible();
    const duplicates = await page.evaluate(() => {
      const seen = new Map<string, number>();
      document.querySelectorAll("[id]").forEach((el) => seen.set(el.id, (seen.get(el.id) ?? 0) + 1));
      return Array.from(seen).filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(duplicates).toEqual([]);
  });

  test("very narrow phone: the ten-star rating stays on one line", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await mockAuthedBase(page);
    await page.route("**/api/tmdb/movie/100**", (route) => route.fulfill({ json: movieDetail() }));
    await page.goto("/movie/100");
    await page.getByRole("button", { name: "Rate this movie" }).click();
    const stars = page.locator(".ant-modal .ant-rate li");
    await expect(stars).toHaveCount(10);
    const tops = await stars.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test("very narrow phone: bottom nav doesn't overflow or clip", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
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
