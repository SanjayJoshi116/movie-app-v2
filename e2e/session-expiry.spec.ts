import { test, expect, MOCK_USER, mockAppApi } from "./fixtures";
import type { UserListDTO } from "../src/types/domain";

// auth-session spec: a forced logout returns the user to their page after signing in.

const LIST = {
  id: 7, name: "Seven", description: "", createdAt: "2026-10-01T00:00:00Z", items: [],
} satisfies UserListDTO;

test("a rejected refresh lands on /login, and signing in returns to the same page", async ({ page }) => {
  // seedAuth's init script would re-seed tokens on the forced logout's reload,
  // so seed only once (clearSession() leaves this flag alone).
  await page.addInitScript((user) => {
    if (localStorage.getItem("e2e_seeded")) return;
    localStorage.setItem("e2e_seeded", "1");
    localStorage.setItem("cinedb_access", "expired-access");
    localStorage.setItem("cinedb_refresh", "revoked-refresh");
    localStorage.setItem("cinedb_user", JSON.stringify(user));
  }, MOCK_USER);
  await mockAppApi(page);

  let signedIn = false;
  await page.route("**/api/lists/**", (route) =>
    signedIn
      ? route.fulfill({ json: { count: 1, next: null, previous: null, results: [LIST] } })
      : route.fulfill({ status: 401, json: { detail: "Token is invalid or expired" } })
  );
  await page.route("**/api/auth/token/refresh/", (route) =>
    route.fulfill({ status: 401, json: { detail: "Token is blacklisted" } })
  );
  await page.route("**/api/auth/login/", (route) => {
    signedIn = true;
    return route.fulfill({ json: { access: "fresh-access", refresh: "fresh-refresh", user: MOCK_USER } });
  });

  await page.goto("/lists/7?sort=title");
  await expect(page).toHaveURL("/login");
  await expect(page.getByLabel("Username")).toBeVisible();

  await page.getByLabel("Username").fill("testuser");
  await page.getByLabel("Password").fill("testpass");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL("/lists/7?sort=title");
  await expect(page.getByRole("heading", { name: "Seven" })).toBeVisible();
});
