import type { Route } from "@playwright/test";
import { test, expect, mockAppApi, mockAuthedBase, paginated, MOCK_USER } from "./fixtures";

// write-feedback spec: a form submit sends one request per activation, even
// when the button is double-clicked while the first request is in flight.

/** Holds every matching request until `release()`, counting them. */
function holdRequests(respond: (route: Route) => Promise<void>) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const state = { count: 0 };
  const handler = async (route: Route) => {
    state.count += 1;
    await gate;
    await respond(route);
  };
  return { handler, state, release };
}

test("double-clicking Register sends one registration request", async ({ page }) => {
  const register = holdRequests((r) =>
    r.fulfill({ json: { access: "fake-access", refresh: "fake-refresh", user: MOCK_USER } })
  );
  await page.route("**/api/auth/register/", register.handler);
  await mockAppApi(page); // what /movies loads once signed in

  await page.goto("/register");
  await page.getByLabel("Username").fill("testuser");
  await page.getByLabel("Email").fill("t@t.com");
  await page.getByLabel("Password", { exact: true }).fill("Str0ng#Passw0rd");
  await page.getByLabel("Confirm Password").fill("Str0ng#Passw0rd");
  const submit = page.getByRole("button", { name: "Register" });
  await submit.dblclick();
  await expect(submit).toBeDisabled();

  register.release();
  await expect(page).toHaveURL("/movies");
  expect(register.state.count).toBe(1);
  await expect(page.locator(".ant-message-error")).toHaveCount(0);
});

test("double-clicking Create in the New List dialog makes one list", async ({ page }) => {
  await mockAuthedBase(page);
  const create = holdRequests((r) =>
    r.fulfill({ status: 201, json: { id: 9, name: "Horror", description: "", createdAt: "2026-10-08T10:00:00Z", items: [] } })
  );
  await page.route("**/api/lists/**", (route) =>
    route.request().method() === "POST" ? create.handler(route) : route.fulfill({ json: paginated([]) })
  );

  await page.goto("/lists");
  await page.getByRole("button", { name: "New List" }).first().click();
  await page.getByLabel("List Name").fill("Horror");
  const ok = page.locator(".ant-modal").getByRole("button", { name: "Create" });
  await ok.dblclick();

  create.release();
  await expect(page.locator(".ant-message-success")).toContainText("List created");
  expect(create.state.count).toBe(1);
  await expect(page.getByText("Horror", { exact: true })).toHaveCount(1);
});
