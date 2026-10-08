import { test, expect, mockAuthedBase } from "./fixtures";

// Detail routes build TMDB proxy paths from `:id`. React Router decodes it, so
// an id like `..%2F..%2Fwatchlist` would turn `/api/tmdb/movie/<id>` into a
// request to `/api/watchlist` (with the user's token, once the TMDB client
// sends it). Invalid ids must show the not-found page and fetch nothing.

const DETAIL_PROXY = /\/api\/tmdb\/(movie|tv|person)\//;

test.describe("detail routes with an invalid id", () => {
  for (const path of ["/movie/abc", "/person/-3", "/tv/0", "/movie/2147483648", "/movie/..%2F..%2Fwatchlist"]) {
    test(`${path} shows not-found and requests nothing for it`, async ({ page }) => {
      await mockAuthedBase(page);
      const suspicious: string[] = [];
      page.on("request", (req) => {
        const url = new URL(req.url());
        if (!url.pathname.startsWith("/api/")) return;
        // The signed-in base loads library lists with ?page=N; a traversed
        // detail request would arrive without it (and with TMDB params).
        const libraryLoad = url.searchParams.has("page") && !url.searchParams.has("append_to_response");
        if (DETAIL_PROXY.test(url.pathname) || (/^\/api\/(watchlist|watched|ratings|lists)\b/.test(url.pathname) && !libraryLoad)) {
          suspicious.push(`${req.method()} ${req.url()}`);
        }
      });

      await page.goto(path);

      await expect(page.getByText("Page not found")).toBeVisible();
      expect(suspicious).toEqual([]);
    });
  }
});
