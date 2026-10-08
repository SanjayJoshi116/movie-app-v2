import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import type { FollowedPersonEntry } from "../src/api/userApi";
import type { WatchlistEntryDTO } from "../src/types/domain";

// write-feedback spec: success only after the server confirms, and a failed
// write leaves the UI as it was. Each failure answers 500 with an empty body,
// so the toast shows the call site's own fallback message.

const FIGHT_CLUB = {
  id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club",
  posterPath: null, voteAverage: 8.4, addedAt: "2024-01-15T10:00:00Z",
} satisfies WatchlistEntryDTO;

const PERSON = { id: 7, name: "Greta Gerwig", profile_path: null, known_for_department: "Directing", popularity: 10 };

const errorToast = (page: import("@playwright/test").Page) => page.locator(".ant-message-error");
const successToast = (page: import("@playwright/test").Page) => page.locator(".ant-message-success");

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
});

test("clear watchlist fails: error shown, items stay", async ({ page }) => {
  await page.route("**/api/watchlist/**", (route) =>
    route.request().url().includes("/watchlist/clear/")
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: paginated([FIGHT_CLUB]) })
  );
  await page.goto("/watchlist");
  await expect(page.getByText("My Watchlist (1)")).toBeVisible();

  await page.getByRole("button", { name: "Clear All" }).click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Clear All" }).click();

  await expect(errorToast(page)).toContainText("Failed to clear watchlist.");
  await expect(successToast(page)).toHaveCount(0);
  await expect(page.getByText("My Watchlist (1)")).toBeVisible();
  await expect(page.getByText("Fight Club")).toBeVisible();
});

test("follow fails: error shown, button still offers Follow", async ({ page }) => {
  await page.route("**/api/tmdb/person/popular**", (route) =>
    route.fulfill({ json: { results: [PERSON], page: 1, total_pages: 1, total_results: 1 } })
  );
  await page.route("**/api/followed-people/**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: paginated([]) })
  );
  await page.goto("/people");
  await page.getByRole("button", { name: "Follow Greta Gerwig" }).click();

  await expect(errorToast(page)).toContainText("Failed to update follow status.");
  await expect(successToast(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Follow Greta Gerwig" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unfollow Greta Gerwig" })).toHaveCount(0);
});

test("rating save fails: dialog stays open with the stars and review", async ({ page }) => {
  await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([FIGHT_CLUB]) }));
  await page.route("**/api/ratings/**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: paginated([]) })
  );
  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Rate" }).click();
  const dialog = page.locator(".ant-modal");
  await dialog.locator(".ant-rate-star").nth(8).click();
  const stars = await dialog.getByText(/\/ 10$/).textContent();
  await dialog.getByLabel("Review text").fill("Holds up.");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(errorToast(page)).toContainText("Failed to save rating.");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(stars!)).toBeVisible();
  await expect(dialog.getByLabel("Review text")).toHaveValue("Holds up.");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("unfollow from a Following card removes the person from the list", async ({ page }) => {
  const entry = { id: 1, personId: 7, name: "Greta Gerwig", profilePath: null } satisfies FollowedPersonEntry;
  await page.route("**/api/followed-people/**", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({ status: 204, body: "" })
      : route.fulfill({ json: paginated([entry]) })
  );
  await page.route("**/api/recommendations/followed-people/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/following");
  await expect(page.getByRole("heading", { name: "Following (1)" })).toBeVisible();

  await page.getByRole("button", { name: "Unfollow Greta Gerwig" }).click();

  await expect(successToast(page)).toContainText("Unfollowed Greta Gerwig");
  await expect(page.getByRole("heading", { name: "Following (0)" })).toBeVisible();
  await expect(page.getByText("You're not following anyone yet.", { exact: false })).toBeVisible();
});
