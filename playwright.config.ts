import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Never retried: a test that fails once fails the run (ci-pipeline spec).
  // Fix the wait instead of adding retries back.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  // CI also writes an HTML report, uploaded as an artifact when the job fails.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    // A fixed locale: the app's region default (Where to Watch, certification)
    // comes from it, and otherwise follows the machine running the tests.
    locale: "en-US",
    // With no retries, "on-first-retry" would never record; CI uploads these
    // with the HTML report when the job fails.
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  // Every spec mocks its API calls (see e2e/fixtures.ts), so only the CRA dev
  // server is needed. Not `npm start`: that also runs kill-port and Django
  // through a machine-specific Python path, which a CI runner doesn't have.
  // Locally an already-running `npm run dev` is reused.
  webServer: {
    command: "npx react-scripts start",
    url: "http://localhost:3000",
    env: { BROWSER: "none" },
    reuseExistingServer: !process.env.CI,
    // A cold CRA compile can take over two minutes; same budget as the Python
    // job's wait-on.
    timeout: 300_000,
  },
});
