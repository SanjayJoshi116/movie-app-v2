import type { Page } from "@playwright/test";
import { test, expect, mockAuthedBase } from "./fixtures";
import type { NewReleaseNotification } from "../src/api/userApi";

const item = (id: number, title: string, isUnread: boolean) =>
  ({
    id, type: "movie", title, posterPath: null, releaseDate: "2026-10-01",
    personName: "Greta Gerwig", isUnread,
  }) satisfies NewReleaseNotification;

const ITEMS = [item(1, "Unread One", true), item(2, "Unread Two", true), item(3, "Already Seen", false)];

/** Overrides the base fixture's empty poll; records polls and mark-seen calls. */
async function mockNotifications(page: Page) {
  const calls = { polls: 0, markSeen: 0 };
  await page.route("**/api/notifications/new-releases/**", (route) => {
    calls.polls += 1;
    return route.fulfill({ json: { items: ITEMS, unreadCount: 2 } });
  });
  await page.route("**/api/notifications/mark-seen/**", (route) => {
    calls.markSeen += 1;
    return route.fulfill({ status: 204, body: "" });
  });
  return calls;
}

const bell = (page: Page) => page.locator('button[aria-label="Notifications"]:visible');
const popup = (page: Page) => page.locator(".ant-dropdown:not(.ant-dropdown-hidden)");
const weight = (page: Page, title: string) =>
  popup(page).getByText(title, { exact: true }).evaluate((el) => getComputedStyle(el).fontWeight);

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

test("sidebar and bottom-nav bells show the same count from one shared poll", async ({ page }) => {
  const calls = await mockNotifications(page);
  await page.goto("/watchlist");
  // Both bells are mounted at every width (CSS hides one), so both badges exist.
  const badges = page.locator('.ant-badge:has(button[aria-label="Notifications"]) .ant-badge-count');
  await expect(badges).toHaveCount(2);
  await expect(badges.nth(0)).toHaveAttribute("title", "2");
  await expect(badges.nth(1)).toHaveAttribute("title", "2");
  // One poller for both bells: exactly one mount-time poll. (StrictMode's
  // replay doesn't add one: the provider mounts before AuthProvider has set
  // the user, so its first real poll runs once, when that flips.) One poller
  // per bell would make 2.
  await page.waitForLoadState("networkidle");
  expect(calls.polls).toBe(1);
});

test("unread items stay marked while open; closing marks them seen", async ({ page }) => {
  const calls = await mockNotifications(page);
  await page.goto("/watchlist");
  await expect(page.locator('.ant-badge-count[title="2"]').first()).toBeAttached();

  await bell(page).click();
  await expect(popup(page).getByText("Unread One", { exact: true })).toBeVisible();
  expect(await weight(page, "Unread One")).toBe("700");
  expect(await weight(page, "Unread Two")).toBe("700");
  expect(await weight(page, "Already Seen")).toBe("400");
  expect(calls.markSeen).toBe(0); // not while the user is still reading

  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect.poll(() => calls.markSeen).toBe(1);
  await expect(page.locator(".ant-badge-count")).toHaveCount(0);

  // Reopened: nothing is shown as unread any more.
  await bell(page).click();
  await expect(popup(page).getByText("Unread One", { exact: true })).toBeVisible();
  expect(await weight(page, "Unread One")).toBe("400");
});
