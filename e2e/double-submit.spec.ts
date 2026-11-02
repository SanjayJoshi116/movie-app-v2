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

test("pressing Enter twice on Reset Password sends one reset request", async ({ page }) => {
  const confirm = holdRequests((r) => r.fulfill({ json: { detail: "Password has been reset." } }));
  await page.route("**/api/auth/password-reset/confirm/", confirm.handler);

  await page.goto("/reset-password/abc/tok-123");
  await page.getByLabel("New Password").fill("Str0ng#Passw0rd");
  const field = page.getByLabel("Confirm Password");
  await field.fill("Str0ng#Passw0rd");
  await field.press("Enter");
  await field.press("Enter");
  await expect.poll(() => confirm.state.count).toBe(1);

  confirm.release();
  await expect(page).toHaveURL("/login");
  expect(confirm.state.count).toBe(1);
  await expect(page.locator(".ant-message-error")).toHaveCount(0);
});

test("pressing Enter twice on Forgot Password sends one email request", async ({ page }) => {
  const request = holdRequests((r) => r.fulfill({ json: { detail: "sent" } }));
  await page.route("**/api/auth/password-reset/", request.handler);

  await page.goto("/forgot-password");
  const email = page.getByLabel("Email");
  await email.fill("t@t.com");
  await email.press("Enter");
  await email.press("Enter");
  await expect.poll(() => request.state.count).toBe(1);

  request.release();
  await expect(page.getByText("If that email is registered")).toBeVisible();
  expect(request.state.count).toBe(1);
});

test("the New List dialog holds while creating and keeps the input when it fails", async ({ page }) => {
  await mockAuthedBase(page);
  const create = holdRequests((r) => r.fulfill({ status: 502, body: "Bad Gateway" }));
  await page.route("**/api/lists/**", (route) =>
    route.request().method() === "POST" ? create.handler(route) : route.fulfill({ json: paginated([]) })
  );

  await page.goto("/lists");
  await page.getByRole("button", { name: "New List" }).first().click();
  const dialog = page.locator(".ant-modal").filter({ hasText: "Create New List" });
  await dialog.getByLabel("List Name").fill("Horror");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect.poll(() => create.state.count).toBe(1);

  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect(dialog).toBeVisible();

  create.release();
  await expect(page.locator(".ant-message-error")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("List Name")).toHaveValue("Horror");
});
