import { test, expect, mockAuthedBase } from "./fixtures";

// A TMDB person's homepage is community-edited, so it can be any string.
async function mockPerson(page: import("@playwright/test").Page, homepage: string) {
  await page.route("**/api/tmdb/person/42**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/person/42")) {
      return route.fulfill({
        json: { id: 42, name: "Some Actor", profile_path: null, biography: "", homepage, known_for_department: "Acting" },
      });
    }
    if (path.endsWith("/images")) return route.fulfill({ json: { id: 42, profiles: [] } });
    return route.fulfill({ json: { id: 42, cast: [], crew: [] } }); // movie_credits / tv_credits
  });
}

test("a javascript: homepage is shown as text, never as a link", async ({ page }) => {
  await mockAuthedBase(page);
  await mockPerson(page, "javascript:alert(document.domain)");
  await page.goto("/person/42");

  await expect(page.getByText("javascript:alert(document.domain)")).toBeVisible();
  await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);
});

test("an https homepage is a link that opens in a new tab", async ({ page }) => {
  await mockAuthedBase(page);
  await mockPerson(page, "https://example.com/");
  await page.goto("/person/42");

  const link = page.getByRole("link", { name: "https://example.com/" });
  await expect(link).toHaveAttribute("href", "https://example.com/");
  await expect(link).toHaveAttribute("target", "_blank");
});
