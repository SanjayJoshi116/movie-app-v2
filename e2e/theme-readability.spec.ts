import type { Locator, Page } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { StatsData } from "../src/api/userApi";
import type { WatchedEntryDTO } from "../src/types/domain";

// theme-readability spec, checked as computed contrast in the browser rather
// than screenshots. The regression these catch is white-on-white (or
// black-on-navy): ~1:1. Text must reach WCAG AA for small text, 4.5:1
// (a11y-motion-titles set the secondary/tertiary tokens to clear it in both
// themes); icons and UI parts 3:1. Empty heatmap cells only need to be visible
// (a faint gray grid measures ~1.09:1 in light mode; white-on-white is 1.0).
const TEXT_MIN = 4.5;
const ICON_MIN = 3;
const CELL_MIN = 1.05;

type Theme = "light" | "dark";

async function forceTheme(page: Page, theme: Theme) {
  // useLocalStorage JSON-parses the stored value.
  await page.addInitScript((t) => localStorage.setItem("cinedb_theme", JSON.stringify(t)), theme);
}

/**
 * Contrast of an element's foreground against what's painted behind it.
 * `what` picks the foreground: text `color`, an SVG `fill`, or the element's
 * own `background-color` (a heatmap cell) against its ancestors'. Translucent
 * colors are composited over the backgrounds below them, down to the first
 * opaque one (or the theme's page color, for gradients).
 */
async function contrast(target: Locator, what: "color" | "background" = "color"): Promise<number> {
  return (await measure(target, what)).ratio;
}

/** `contrast`'s workings: the ratio plus the composited background (r, g, b). */
async function measure(target: Locator, what: "color" | "background") {
  return target.evaluate((el, mode) => {
    type RGBA = [number, number, number, number];
    const parse = (c: string): RGBA | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m?.[1]) return null;
      const [r = 0, g = 0, b = 0, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [r, g, b, a];
    };
    const over = ([r, g, b, a]: RGBA, [ur, ug, ub]: RGBA): RGBA =>
      [r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a), 1];
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: RGBA) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const dark = document.body.classList.contains("dark-theme");
    const pageColor: RGBA = dark ? [13, 15, 26, 1] : [248, 243, 232, 1];

    const backdrop = (start: Element | null): RGBA => {
      const layers: RGBA[] = [];
      for (let n: Element | null = start; n; n = n.parentElement) {
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg && bg[3] > 0) {
          layers.push(bg);
          if (bg[3] >= 1) break;
        }
      }
      const last = layers[layers.length - 1];
      let base = last && last[3] >= 1 ? (layers.pop() as RGBA) : pageColor;
      for (let top = layers.pop(); top; top = layers.pop()) base = over(top, base);
      return base;
    };

    const style = getComputedStyle(el);
    let fg: RGBA;
    let bg: RGBA;
    if (mode === "background") {
      bg = backdrop(el.parentElement);
      fg = over(parse(style.backgroundColor)!, bg);
    } else {
      bg = backdrop(el);
      const raw = parse(el instanceof SVGElement && style.fill !== "none" ? style.fill : style.color)!;
      fg = over(raw, bg);
    }
    const hi = Math.max(lum(fg), lum(bg));
    const lo = Math.min(lum(fg), lum(bg));
    const [r, g, b] = mode === "background" ? fg : bg;
    return { ratio: (hi + 0.05) / (lo + 0.05), painted: { r, g, b } };
  }, what);
}

function localDay(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATS: StatsData = {
  totalWatched: 3, moviesCount: 3, tvCount: 0, totalRatings: 3, avgUserRating: 7.3, avgTmdbRating: 7.5,
  ratingDistribution: Array.from({ length: 10 }, (_, i) => ({ rating: String(i + 1), count: i === 6 ? 2 : 0 })),
  monthlyActivity: [{ month: "Jan 2026", count: 1 }, { month: "Feb 2026", count: 0 }, { month: "Mar 2026", count: 2 }],
  topGenres: [{ genre: "Drama", count: 3 }],
  languageBreakdown: [], decadeBreakdown: [],
  dailyActivity: [{ date: localDay(1), count: 2 }],
  topRatedItems: [], recentItems: [], totalRuntimeMinutes: 0, platformBreakdown: [],
  ratingByGenre: [{ genre: "Drama", avgRating: 7.3 }],
  reviewsWritten: 0, listsCount: 0, listsItemsCount: 0, watchlistTotal: 0, watchlistUnwatched: 0,
};

async function openStats(page: Page, theme: Theme) {
  await forceTheme(page, theme);
  await mockAuthedBase(page);
  await page.route("**/api/stats/**", (route) => route.fulfill({ json: STATS }));
  await page.goto("/stats");
  await expect(page.getByText("Total Watched", { exact: true })).toBeVisible();
}

const heatmap = (page: Page) => page.getByRole("group", { name: /Watch activity by day/ });

for (const theme of ["light", "dark"] as const) {
  test.describe(`Stats in ${theme} mode`, () => {
    test("stat labels, legend and month labels are readable", async ({ page }) => {
      await openStats(page, theme);
      const targets = {
        "stat label": page.getByText("Total Watched", { exact: true }),
        "legend Less": page.getByText("Less", { exact: true }),
        "legend More": page.getByText("More", { exact: true }),
        "month label": heatmap(page).locator("xpath=preceding-sibling::div[1]/div[normalize-space()]").first(),
      };
      for (const [name, target] of Object.entries(targets)) {
        expect(await contrast(target), name).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    });

    test("empty heatmap cells are visible", async ({ page }) => {
      await openStats(page, theme);
      // The oldest day: no activity, never in the future.
      const cell = heatmap(page).locator(":scope > div").first().locator(":scope > div").first();
      expect(await contrast(cell, "background")).toBeGreaterThanOrEqual(CELL_MIN);
    });

    test("chart and heatmap tooltips are readable", async ({ page, isMobile }) => {
      test.skip(isMobile, "hover tooltips");
      await openStats(page, theme);
      await page.locator(".ant-card").filter({ hasText: "Rating by Genre" }).locator(".recharts-bar-rectangle").first().hover();
      const chartTip = page.getByText("7.3 Avg rating");
      await expect(chartTip).toBeVisible();
      expect(await contrast(chartTip), "chart tooltip").toBeGreaterThanOrEqual(TEXT_MIN);

      await heatmap(page).locator(":scope > div").first().locator(":scope > div").first().hover();
      const heatTip = page.locator("body > div").filter({ hasText: / — \d+ items?$/ });
      await expect(heatTip).toBeVisible();
      expect(await contrast(heatTip), "heatmap tooltip").toBeGreaterThanOrEqual(TEXT_MIN);
    });
  });
}

test.describe("light mode icons, empty states and placeholders", () => {
  const MOVIE = {
    id: 550, title: "No Poster Film", poster_path: null, backdrop_path: null, release_date: "1999-10-15",
    vote_average: 8.4, vote_count: 100, genre_ids: [18], overview: "", popularity: 50, adult: false,
    original_language: "en", original_title: "No Poster Film", video: false,
  };

  test.beforeEach(async ({ page }) => {
    await forceTheme(page, "light");
    await mockAuthedBase(page);
  });

  test("idle card icons use the theme text color, not pure black", async ({ page }) => {
    await page.route("**/api/tmdb/discover/movie**", (route) =>
      route.fulfill({ json: { results: [MOVIE], page: 1, total_pages: 1, total_results: 1 } }));
    await page.goto("/movies");
    for (const name of ["Mark as watched", "Add to watchlist"]) {
      const icon = page.getByRole("button", { name }).first();
      await expect(icon).toBeVisible();
      expect(await icon.evaluate((el) => getComputedStyle(el).color), name).not.toBe("rgb(0, 0, 0)");
      expect(await contrast(icon), name).toBeGreaterThanOrEqual(ICON_MIN);
    }
  });

  test("a missing poster has a light placeholder with readable text", async ({ page }) => {
    await page.route("**/api/tmdb/discover/movie**", (route) =>
      route.fulfill({ json: { results: [MOVIE], page: 1, total_pages: 1, total_results: 1 } }));
    await page.goto("/movies");
    const placeholder = page.getByText("No Image").first();
    await expect(placeholder).toBeVisible();
    expect(await contrast(placeholder), "placeholder text").toBeGreaterThanOrEqual(TEXT_MIN);
    // A light fill (as painted, over the card): not the dark-navy block it used to be.
    const { r, g, b } = (await measure(placeholder, "background")).painted;
    expect(0.299 * r + 0.587 * g + 0.114 * b, `rgb(${r}, ${g}, ${b})`).toBeGreaterThan(160);
  });

  test("empty-state icons are readable on Search, Calendar and For You", async ({ page }) => {
    const WATCHED = {
      id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club", posterPath: null, voteAverage: 8.4,
      watchedAt: "2024-01-15T10:00:00Z", watchedTz: "", originalLanguage: "en", releaseYear: 1999,
      runtimeMinutes: null, platform: null,
    } satisfies WatchedEntryDTO;
    await page.route("**/api/watched/**", (route) => route.fulfill({ json: paginated([WATCHED]) }));
    await page.route("**/api/recommendations/for-you/**", (route) => route.fulfill({ json: { status: "ready", sections: [] } }));
    await page.route("**/api/recommendations/personalized/**", (route) => route.fulfill({ json: { status: "ready", sections: [] } }));
    await page.route("**/api/recommendations/followed-people/**", (route) => route.fulfill({ json: [] }));

    for (const path of ["/search", "/calendar", "/recommendations"]) {
      await page.goto(path);
      const icon = page.locator(".ant-empty .anticon, .ant-result-icon .anticon, [data-empty-icon]").first();
      await expect(icon, path).toBeVisible();
      expect(await contrast(icon), path).toBeGreaterThanOrEqual(ICON_MIN);
    }
  });
});

for (const theme of ["dark", "light"] as const) {
  test.describe(`Sign-in page in ${theme} mode`, () => {
    test("wordmark, tagline, form text, links and the button text are readable (login-page)", async ({ page }) => {
      await forceTheme(page, theme);
      await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
      await page.goto("/login");
      const targets: [string, Locator][] = [
        ["wordmark", page.getByRole("heading", { level: 1, name: "CINE DB" })],
        ["tagline", page.getByText("Track what you've watched and find what to watch next.")],
        ["heading", page.getByRole("heading", { level: 2, name: "Sign In" })],
        ["username label", page.locator("label[for='username']")],
        ["password label", page.locator("label[for='password']")],
        ["button text", page.getByRole("button", { name: "Sign In" }).locator("span").last()],
        ["forgot link", page.getByRole("link", { name: "Forgot password?" })],
        ["register prompt", page.getByText("No account?")],
        ["register link", page.getByRole("link", { name: "Register" })],
      ];
      for (const [name, target] of targets) {
        await expect(target, name).toBeVisible();
        expect(await contrast(target), name).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    });
  });
}

// auth-pages: the account pages share the sign-in page's stage.
const ACCOUNT_PAGES: { name: string; path: string; heading: string; texts: string[]; sent?: boolean }[] = [
  { name: "Create account", path: "/register", heading: "Create Account", texts: ["Already have an account?"] },
  { name: "Forgot password", path: "/forgot-password", heading: "Forgot Password",
    texts: ["Enter your account email to receive a password reset link."] },
  { name: "Forgot password, sent", path: "/forgot-password", heading: "Check Your Inbox", sent: true,
    texts: ["If that email is registered, a reset link has been sent. Check your inbox and follow the link."] },
  { name: "Reset password", path: "/reset-password/abc123/token456", heading: "Reset Password", texts: [] },
];

for (const theme of ["dark", "light"] as const) {
  for (const p of ACCOUNT_PAGES) {
    test(`${p.name} in ${theme} mode: wordmark, tagline and card text are readable (auth-pages)`, async ({ page }) => {
      await forceTheme(page, theme);
      await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
      await page.route("**/api/auth/password-reset/", (route) =>
        route.fulfill({ json: { detail: "If that email is registered, a reset link has been sent." } }));
      await page.goto(p.path);
      if (p.sent) {
        await page.getByLabel("Email").fill("user@example.com");
        await page.getByRole("button", { name: "Send Reset Link" }).click();
      }
      const card = page.locator(".auth-screen");
      const targets: [string, Locator][] = [
        ["wordmark", page.getByRole("heading", { level: 1, name: "CINE DB" })],
        ["tagline", page.getByText("Track what you've watched and find what to watch next.")],
        ["heading", page.getByRole("heading", { level: 2, name: p.heading })],
        ...p.texts.map((t): [string, Locator] => [t, page.getByText(t)]),
      ];
      await expect(targets[2]![1]).toBeVisible();
      const labels = card.locator("label");
      for (let i = 0; i < (await labels.count()); i++) targets.push([`label ${i}`, labels.nth(i)]);
      const links = card.getByRole("link");
      for (let i = 0; i < (await links.count()); i++) targets.push([`link ${i}`, links.nth(i)]);
      const button = card.locator(".ant-btn-primary");
      if (await button.count()) targets.push(["button text", button.locator("span").last()]);
      for (const [name, target] of targets) {
        await expect(target, name).toBeVisible();
        expect(await contrast(target), name).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    });
  }

  test(`sidebar wordmark in ${theme} mode is readable, full and in the rail (theme-readability)`, async ({ page }) => {
    await forceTheme(page, theme);
    await mockAuthedBase(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/watchlist");
    const full = page.locator(".app-sidebar").getByRole("heading", { name: "CINE DB" });
    await expect(full).toBeVisible();
    expect(await contrast(full), "full wordmark").toBeGreaterThanOrEqual(TEXT_MIN);
    // One line: no taller than a single line box.
    const lineHeight = await full.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect((await full.boundingBox())!.height).toBeLessThan(lineHeight * 1.5);

    await page.setViewportSize({ width: 800, height: 1024 });
    const compact = page.locator(".app-sidebar .sidebar-logo-compact");
    await expect(compact).toBeVisible();
    expect(await contrast(compact), "rail mark").toBeGreaterThanOrEqual(TEXT_MIN);
  });

  test(`primary button text and links in ${theme} mode are brand-colored and readable (theme-readability)`, async ({ page }) => {
    await forceTheme(page, theme);
    await mockAuthedBase(page);
    await page.setViewportSize({ width: 1366, height: 768 }); // sidebar shown
    await page.goto("/watchlist");
    const button = page.getByRole("button", { name: "Browse Movies" });
    await expect(button).toBeVisible();
    const label = button.locator("span").last();
    expect(await contrast(label), "button text").toBeGreaterThanOrEqual(TEXT_MIN);
    expect(await label.evaluate((el) => getComputedStyle(el).color), "button text is dark").toBe("rgb(0, 0, 0)");
    // Menu entries are links too, and keep the menu's own text color.
    const menuItem = page.locator(".app-sidebar .ant-menu-item:not(.ant-menu-item-selected)").first();
    await expect(menuItem).toBeVisible();
    expect(await menuItem.locator("a").first().evaluate((el) => getComputedStyle(el).color), "menu link")
      .toBe(await menuItem.evaluate((el) => getComputedStyle(el).color));

    await page.route("**/api/tmdb/person/7**", (route) => route.fulfill({ json: {
      id: 7, name: "Greta Gerwig", profile_path: null, known_for_department: "Directing", biography: "",
      birthday: null, deathday: null, place_of_birth: null, popularity: 10, imdb_id: "nm1950086", homepage: null,
    } }));
    await page.route("**/api/tmdb/person/7/movie_credits**", (route) => route.fulfill({ json: { cast: [], crew: [] } }));
    await page.route("**/api/tmdb/person/7/tv_credits**", (route) => route.fulfill({ json: { cast: [], crew: [] } }));
    await page.route("**/api/tmdb/person/7/images**", (route) => route.fulfill({ json: { profiles: [] } }));
    await page.goto("/person/7");
    const link = page.getByRole("link", { name: "View on IMDb" });
    await expect(link).toBeVisible();
    // Dark: the dark algorithm's gold (#d3aa17), the same as its primary buttons. Light: brass.
    await expect(link, "link is brand-colored").toHaveCSS("color", theme === "dark" ? "rgb(211, 170, 23)" : "rgb(125, 95, 0)");
    expect(await contrast(link), "link").toBeGreaterThanOrEqual(TEXT_MIN);
  });
}
