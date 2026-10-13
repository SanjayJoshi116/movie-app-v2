import { test, expect, mockAuthedBase, paginated, tvDetail } from "./fixtures";
import type { FollowedPersonEntry } from "../src/api/userApi";
import type { RatingEntryDTO, WatchlistEntryDTO } from "../src/types/domain";

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
  const entry = { id: 1, personId: 7, name: "Greta Gerwig", profilePath: null, followedAt: "2026-10-01T10:00:00Z" } satisfies FollowedPersonEntry;
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

test("remove an existing rating: deleted, dialog closes, title shows unrated", async ({ page }) => {
  const rating = {
    id: 31, mediaId: 550, mediaType: "movie", title: "Fight Club",
    userRating: 8, review: "", ratedAt: "2024-02-01T10:00:00Z",
  } satisfies RatingEntryDTO;
  const deletes: string[] = [];
  await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([FIGHT_CLUB]) }));
  await page.route("**/api/ratings/**", (route) => {
    if (route.request().method() === "DELETE") {
      deletes.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ json: paginated([rating]) });
  });
  await page.goto("/watchlist");
  await expect(page.getByText("My: 8/10")).toBeVisible();

  await page.getByRole("button", { name: "Edit rating" }).click();
  const dialog = page.locator(".ant-modal");
  await dialog.getByRole("button", { name: "Remove rating" }).click();
  await page.locator(".ant-popconfirm").getByRole("button", { name: "Remove" }).click();

  await expect(successToast(page)).toContainText("Rating removed");
  expect(deletes).toEqual(["/api/ratings/31/"]);
  await expect(dialog).toBeHidden();
  await expect(page.getByText("My: 8/10")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rate", exact: true })).toBeVisible();
});

test("unrated title: the rating dialog offers no remove action", async ({ page }) => {
  await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([FIGHT_CLUB]) }));
  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Rate", exact: true }).click();
  const dialog = page.locator(".ant-modal");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Remove rating" })).toHaveCount(0);
});

test("mark as watched fails: error shown, no success, item stays not watched", async ({ page }) => {
  await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([FIGHT_CLUB]) }));
  await page.route("**/api/watched/**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: paginated([]) })
  );
  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Mark watched", exact: true }).click();
  await page.locator(".ant-modal").getByRole("button", { name: "Mark Watched" }).click();

  await expect(errorToast(page)).toContainText("Failed to mark as watched.");
  await expect(successToast(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark watched", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark unwatched", exact: true })).toHaveCount(0);
});

test("episode progress save fails: error shown, editor keeps the chosen season and episode", async ({ page }) => {
  await page.route("**/api/tmdb/tv/200**", (route) =>
    route.fulfill({ json: tvDetail({
      seasons: [
        { season_number: 1, episode_count: 10, name: "Season 1" },
        { season_number: 2, episode_count: 10, name: "Season 2" },
      ],
    }) })
  );
  // The episode guide's season requests match the pattern above too.
  await page.route("**/api/tmdb/tv/200/season/**", (route) => route.fulfill({ json: { episodes: [] } }));
  await page.route("**/api/episode-progress/**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: null })
  );
  await page.goto("/tv/200");
  await page.getByRole("button", { name: "Track episode progress" }).click();
  await page.getByRole("button", { name: "Next season" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next episode" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(errorToast(page)).toContainText("Failed to save episode progress.");
  await expect(successToast(page)).toHaveCount(0);
  const nextSeason = page.getByRole("button", { name: "Next season" });
  await expect(nextSeason).toBeVisible();
  // The stepper values sit right after their "+" buttons' "−" siblings: S 2, E 4.
  await expect(nextSeason.locator("xpath=preceding-sibling::*[1]")).toHaveText("2");
  await expect(page.getByRole("button", { name: "Next episode" }).locator("xpath=preceding-sibling::*[1]")).toHaveText("4");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});

test("episode progress that fails to load offers Retry, never 'Track'", async ({ page }) => {
  let fail = true;
  await page.route("**/api/tmdb/tv/200**", (route) => route.fulfill({ json: tvDetail() }));
  await page.route("**/api/tmdb/tv/200/season/**", (route) => route.fulfill({ json: { episodes: [] } }));
  await page.route("**/api/episode-progress/**", (route) =>
    fail
      ? route.fulfill({ status: 500, json: {} })
      : route.fulfill({ json: { showId: 200, season: 3, episode: 4 } })
  );
  await page.goto("/tv/200");

  await expect(page.getByText("Couldn't load your episode progress.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Track episode progress" })).toHaveCount(0);

  fail = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("S03E04")).toBeVisible();
});

test("the rating dialog can't be closed while its save is in flight", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/watchlist/**", (route) => route.fulfill({ json: paginated([FIGHT_CLUB]) }));
  await page.route("**/api/ratings/**", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: paginated([]) });
    await held;
    return route.fulfill({ status: 201, json: {
      id: 1, mediaId: 550, mediaType: "movie", title: "Fight Club", userRating: 8, review: "", ratedAt: "2026-10-13T10:00:00Z",
    } satisfies RatingEntryDTO });
  });
  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Rate", exact: true }).click();
  const dialog = page.locator(".ant-modal");
  await dialog.locator(".ant-rate-star").nth(7).click();
  await dialog.getByRole("button", { name: "Save" }).click();

  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5); // outside the dialog
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect(dialog).toBeVisible();

  release();
  await expect(successToast(page)).toContainText("Rating saved");
  await expect(dialog).toBeHidden();
});
