import { test, expect, mockAppApi, MOCK_USER } from "./fixtures";

// Mocks for backend — tests run without a real Django server

test.beforeEach(async ({ page }) => {
  // Block all Django API calls; intercept as needed per test
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
  await page.route("**/api/tmdb/**", (route) => route.fulfill({ json: { results: [], total_pages: 1, total_results: 0 } }));
});

test.describe("Login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    // Use 400 not 401: a 401 triggers the JWT refresh interceptor which redirects to /login
    await page.route("**/api/auth/login/", (route) =>
      route.fulfill({ status: 400, json: { detail: "Invalid credentials." } })
    );

    await page.goto("/login");
    await page.getByLabel("Username").fill("wronguser");
    await page.getByLabel("Password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Ant Design message.error renders in a portal — locate by class
    await expect(page.locator(".ant-message-notice-content")).toContainText("Invalid username or password.", { timeout: 8_000 });
  });

  test("keeps username filled in after a failed login", async ({ page }) => {
    await page.route("**/api/auth/login/", (route) =>
      route.fulfill({ status: 400, json: { detail: "Invalid credentials." } })
    );

    await page.goto("/login");
    await page.getByLabel("Username").fill("wronguser");
    await page.getByLabel("Password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".ant-message-notice-content")).toContainText("Invalid username or password.", { timeout: 8_000 });
    await expect(page.getByLabel("Username")).toHaveValue("wronguser");
    await expect(page.getByLabel("Password")).toHaveValue("");
  });

  test("shows a connection error when the server is unreachable", async ({ page }) => {
    await page.route("**/api/auth/login/", (route) => route.abort("connectionrefused"));

    await page.goto("/login");
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Password").fill("testpass");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".ant-message-notice-content")).toContainText(
      "Can't reach the server. Check your connection and try again.",
      { timeout: 8_000 }
    );
  });

  test("redirects to /movies after successful login", async ({ page }) => {
    await page.route("**/api/auth/login/", (route) =>
      route.fulfill({
        json: {
          access: "fake-access-token",
          refresh: "fake-refresh-token",
          user: MOCK_USER,
        },
      })
    );
    // The API calls that fire on authenticated load
    await mockAppApi(page);

    await page.goto("/login");
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Password").fill("testpass");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL("/movies");
  });

  test("shows the rate-limit message on 429", async ({ page }) => {
    await page.route("**/api/auth/login/", (route) =>
      route.fulfill({ status: 429, json: { detail: "Request was throttled." } })
    );
    await page.goto("/login");
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Password").fill("testpass");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator(".ant-message-notice-content")).toContainText(
      "Too many login attempts. Please wait a moment and try again.",
      { timeout: 8_000 }
    );
  });

  test("focuses the username field on load", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Username")).toBeFocused();
  });

  test("submits the trimmed username", async ({ page }) => {
    const bodies: { username: string }[] = [];
    await page.route("**/api/auth/login/", (route) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 400, json: { detail: "Invalid credentials." } });
    });
    await page.goto("/login");
    await page.getByLabel("Username").fill("  testuser  ");
    await page.getByLabel("Password").fill("testpass");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator(".ant-message-notice-content")).toBeVisible({ timeout: 8_000 });
    expect(bodies.map((b) => b.username)).toEqual(["testuser"]);
  });

  test("locks the form while the login request is in flight", async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/auth/login/", async (route) => {
      await held;
      await route.fulfill({ status: 400, json: { detail: "Invalid credentials." } });
    });
    await page.goto("/login");
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Password").fill("testpass");
    const submit = page.getByRole("button", { name: "Sign In" });
    await submit.click();

    await expect(page.getByLabel("Username")).toBeDisabled();
    await expect(page.getByLabel("Password")).toBeDisabled();
    await expect(submit).toBeDisabled();

    release();
    await expect(page.locator(".ant-message-notice-content")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByLabel("Username")).toBeEnabled();
    await expect(page.getByLabel("Password")).toBeEnabled();
    await expect(submit).toBeEnabled();
  });

  test("returns to the full original location after login", async ({ page }) => {
    await page.route("**/api/auth/login/", (route) =>
      route.fulfill({ json: { access: "fake-access-token", refresh: "fake-refresh-token", user: MOCK_USER } })
    );
    await mockAppApi(page);

    await page.goto("/search?q=nolan&tab=people");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Password").fill("testpass");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL("/search?q=nolan&tab=people");
    await expect(page.locator(".ant-tabs-tab-active")).toHaveText("People");
    await expect(page.getByText('No people found for "nolan"')).toBeVisible();
  });

  test("unauthenticated /movies redirects to /login", async ({ page }) => {
    await page.goto("/movies");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /watchlist redirects to /login", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Register page", () => {
  test("renders register form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Create Account")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    // exact: the register form also has "Confirm Password"
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Register" })).toBeVisible();
  });

  test("shows validation error for short password", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Username").fill("newuser");
    await page.getByLabel("Password", { exact: true }).fill("abc");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("At least 8 characters")).toBeVisible();
  });
});

test.describe("Forgot password page", () => {
  test("renders forgot password form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Forgot Password")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();
  });

  test("shows success state after submission", async ({ page }) => {
    await page.route("**/api/auth/password-reset/", (route) =>
      route.fulfill({ json: { detail: "If that email is registered, a reset link has been sent." } })
    );

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    await expect(page.getByRole("heading", { name: "Check Your Inbox" })).toBeVisible();
  });
});
