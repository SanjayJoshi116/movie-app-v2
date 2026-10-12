## Why

Every page has become slow under `npm start`. A measured capture on 2026-10-10 (`docs/BUG_BACKLOG.md` item 26) found these causes:

- **`localhost` falls back from IPv6.** The frontend calls `http://localhost:8000`, which resolves to `::1` first, while `runserver` listens on IPv4 only. Each new browser connection pays about 300 ms; a Python client pays 2 s against 5 ms on `127.0.0.1`.
- **Every call is preflighted.** Dev is cross-origin, so every API call needs a CORS preflight. Since 0.20 that includes TMDB calls, which now carry a token.
- **Detail pages fan out.** A detail page sends 5–6 TMDB calls and renders only after the slowest. The dev build sends each one twice, and the copies queue behind Chrome's 6-connection limit, so the title appears after 3.1 s.
- **The TMDB proxy caches nothing.** Each call takes 0.35–1.3 s, even when it repeats one from seconds earlier.
- **Library loads are sequential.** They fetch 100 rows per request, one request after another: about 3.3 s for a 1,300-title watched history on every reload.
- **Images are oversized and trailers are eager.** Backdrops load at `original` size (often 1–5 MB), grid posters at `w500`, and every trailer iframe loads the YouTube player up front.

Production (nginx, same-origin) avoids the first two, but shares the rest. It also opens a new database connection per request.

## What Changes

- **Dev API traffic goes same-origin.** CRA's dev server proxies `/api` and `/media` to `http://127.0.0.1:8000`. The client defaults become relative (`/api`, `/api/tmdb`, media `""`). This removes the IPv6 fallback and every preflight in dev. Production keeps its explicit `REACT_APP_*` values and nginx routing unchanged.
- **Detail pages fetch in one request.** Movie and TV detail pages fold reviews, similar titles, watch providers, release dates or content ratings, credits and images into the main details call through TMDB's `append_to_response`. That's one request instead of 5–6.
- **Identical TMDB requests are shared.** The TMDB client shares one request among identical GETs that are in flight at the same time. The dev build's double mount, and any two components asking for the same data, then cost one request.
- **The TMDB proxy caches successful responses.** It keys on path plus parameters and uses three TTL tiers: about 10 minutes for lists and search, about 6 hours for details, about 24 hours for genre and configuration data. It never caches a request that carries a user credential (`session_id`) or an error response. The cache lives in a dedicated cache alias, so it can't evict throttle counters.
- **Library lists load in pages of 500.** The pagination class accepts `page_size` up to 500, and the watched, watchlist and ratings loads request it. A 1,300-title history then takes 3 requests instead of 13.
- **Images are sized for display.** Grid posters use `w342`, hero and detail backdrops use `w1280`, and `original` stays only for the full-screen image preview. The above-the-fold hero backdrop is no longer lazy-loaded.
- **Trailers load on demand.** A shared trailer component shows the YouTube thumbnail with a play button and creates the iframe only when the user activates it. The CSP gains `https://i.ytimg.com` in `img-src`.
- **`App` stops re-rendering on library changes.** It reads the UI context directly instead of `useAppContext()`, which subscribes to all four data contexts. Library loads and toggles then stop re-rendering the whole route tree.
- **Production reuses database connections.** `CONN_MAX_AGE` is 60 s when `DEBUG` is off, and stays 0 under `runserver`, where each request runs on its own thread.

Out of scope, kept in the backlog:
- a psycopg 3 connection pool for dev (a dependency swap)
- a watched-list sort index
- parallel page fetching

## Capabilities

### New Capabilities
- `page-performance`: request-count and payload rules for page loads. Covers same-origin dev API traffic, one TMDB request per detail page, sharing of identical in-flight TMDB requests, bounded request counts for library loads, image sizes for display, and on-demand trailers.
- `tmdb-proxy-cache`: server-side caching of TMDB proxy responses (what is cached, for how long, what never is, isolation from other cache users).

### Modified Capabilities
- `load-states`: "Detail pages degrade per section" now covers secondary sections that arrive inside one combined response. A missing or empty appended part renders that section empty; the 404, error and Retry behavior is unchanged.
- `container-deployment`: the CSP requirement now allows the trailer thumbnail host (`https://i.ytimg.com`) for images.

## Impact

- **Frontend:**
  - `package.json` (`proxy`)
  - `src/api/userApi.ts`, `src/api/tmdb.ts`, `src/constants/media.ts` (base URLs; in-flight sharing in `tmdb.ts`)
  - `src/utils/fetchAllPages.ts` and the watched, watchlist and ratings hooks
  - `src/pages/MovieDetailPage.tsx`, `src/pages/TVDetailPage.tsx`, `src/components/MovieDetails.tsx`, `src/components/TVShowDetails.tsx`
  - a new shared trailer component
  - `src/constants/ui.ts` and the grid card components (image sizes)
  - `src/components/HeroBanner.tsx`, `src/App.tsx`
- **Backend:**
  - `backend/userdata/tmdb_proxy_views.py` (cache)
  - `backend/cinedb/settings.py` (a `tmdb` cache alias, `CONN_MAX_AGE`)
  - `backend/userdata/pagination.py` (`page_size_query_param`, max 500)
  - the cache table is created by the existing `createcachetable` step in `start.py` and `docker-entrypoint.sh`
- **Infra:** `nginx.conf` CSP `img-src`.
- **Tests:**
  - backend tests for the proxy cache, page size and settings
  - Jest tests for `fetchAllPages` past page 1, request sharing, and single-request detail pages
  - the TS and Python e2e detail-page mocks move to the combined response shape
- **Docs:** CLAUDE.md (the dev cross-origin/CORS note, the TMDB proxy and client notes), `docs/ARCHITECTURE.md` (rationale), and the `docs/BUG_BACKLOG.md` item 26 status.
- **No API contract changes for clients:** `page_size` is optional, and proxy responses are byte-for-byte what TMDB returned.
