## 1. Baseline

- [x] 1.1 Re-measure before any change with a throwaway `verify_perf.py` against the running `npm start`. Use a throwaway account (delete it afterwards) and record `/movies` load, `/movie/550` time to title and to network idle, the preflight count, and TMDB calls per page. Delete the script.

## 2. Dev same-origin API

- [x] 2.1 Add `"proxy": "http://127.0.0.1:8000"` to `package.json`.
- [x] 2.2 Change the client defaults to relative URLs: `userApi.ts` → `/api`, `tmdb.ts` → `/api/tmdb`, `constants/media.ts` `MEDIA_BASE_URL` → `""`. Keep the `REACT_APP_*` overrides. Remove the now-unused `API_HOST` constants.
- [x] 2.3 Check that `/api/**`, `/api/tmdb/**` and `/media/**` (an uploaded avatar) work through the dev server, the browser sends no `OPTIONS`, and the app loads on another device by LAN IP.
- [x] 2.4 Run TS Playwright and Python e2e smoke files (auth, browse) to confirm the `**/api/**` mocks still intercept relative URLs.

## 3. TMDB client: shared in-flight requests

- [x] 3.1 Add `sharedGet` in `src/api/tmdb.ts`: key from `api.getUri({ url, params })`, a map of in-flight promises, each entry deleted on settle. Route every exported fetcher through it.
- [x] 3.2 Jest: two identical concurrent calls make one request and both resolve; a call after settle makes a new one; different params make separate requests; a rejection reaches every waiter and clears the entry. Keep the existing 401-retry tests green.

## 4. Detail pages in one request

- [x] 4.1 Extend the detail types in `src/types/tmdb.ts` with optional appended parts (`reviews`, `similar`, `"watch/providers"`, `release_dates`; TV `credits`, `aggregate_credits`, `images`, `content_ratings`).
- [x] 4.2 `fetchMovieDetails` appends `credits,images,videos,recommendations,reviews,similar,watch/providers,release_dates`. `MovieDetailPage` makes only that call and maps each part through a shape guard (empty list or object when absent or malformed).
- [x] 4.3 `fetchTVDetails` appends `external_ids,similar,recommendations,videos,aggregate_credits,images,reviews,watch/providers`. (Deviation: no `credits`/`content_ratings`; the page renders neither; see design.md.) `TVDetailPage` makes only that call. Fold in any per-title TMDB call left in `TVShowDetails`/`MovieDetails`, such as content ratings or certification; the season episode guide stays separate.
- [x] 4.4 Remove fetchers that are now unused; keep the ones other code still calls.
- [x] 4.5 (Done as Python e2e in `test_detail.py`: no Jest page tests exist, and rendering needs the full provider stack; the single-request test fails with sharing off.) Jest or component tests: a detail page issues exactly one TMDB request; a missing or malformed appended part leaves only that section empty; a 404 still shows not-found, and a 5xx shows Retry.
- [x] 4.6 Move the e2e detail mocks to the combined response: `e2e/movies.spec.ts`, `e2e/python/conftest.py`, `e2e/python/test_detail.py`, and `test_browse.py` where it touches detail pages. Rewrite "reviews request fails" style tests as "reviews part missing". Remove mocks for routes no longer called. Run both e2e detail suites.

## 5. TMDB proxy cache (backend)

- [x] 5.1 `settings.py`: add a `tmdb` cache alias. Under DEBUG: LocMem with `MAX_ENTRIES` 1000. Otherwise: `DatabaseCache` `tmdb_proxy_cache` with `MAX_ENTRIES` 2000. Confirm `createcachetable` creates it.
- [x] 5.2 `tmdb_proxy_views.py`:
  - key = sha256 of the path and the forwarded param list (no `api_key`)
  - TTL tiers 600 / 86,400 / 21,600 s by path, as in design.md
  - bypass `session_id`/`guest_session_id` and `account/`/`authentication/` paths
  - store only status 200 bodies
  - `X-Cache: HIT|MISS` header
  - cache backend errors (`django.db.Error`) are a miss or skipped write, never a 500
  - all cache work on the request thread
- [x] 5.3 Update `test_tmdb_proxy.py`: clear the `tmdb` cache in `setUp` of the existing classes.
- [x] 5.4 Add tests:
  - a repeat request hits the cache (upstream called once, same body and status)
  - different params miss
  - 404, 5xx and connection failure aren't cached
  - `session_id` bypasses read and write
  - TTL tier per path
  - throttle still counts hits
  - filling the `tmdb` cache leaves `default` entries intact
  - a cache error falls through to upstream
- [x] 5.5 Confirm the proxy time-budget test still passes (the cache adds no upstream time).

## 6. Library loads in pages of 500

- [x] 6.1 `pagination.py`: `page_size_query_param = "page_size"`, `max_page_size = 500`. Backend test: `page_size=500` returns up to 500, above 500 is capped, and no param keeps 100.
- [x] 6.2 `fetchAllPages(api, url, { pageSize })` sends `page_size` with `page`. The watched, watchlist and ratings hooks pass 500.
- [x] 6.3 Jest for `fetchAllPages`: follows `next` past page 1, sends `page_size`, accepts a bare array, and returns no duplicates (closes the item-21 gap).

## 7. Images and trailers

- [x] 7.1 `constants/ui.ts`: add `POSTER_URL` (`w342`) and `YT_THUMB_URL`; `BACKDROP_URL` → `w1280`; add `BACKDROP_ORIGINAL_URL`.
- [x] 7.2 Switch the grid cards to `POSTER_URL`: `Movie`, `TVShowCard`, `MediaCardGrid`, `LibraryItemCard`, Search, Recommendations, Calendar, Lists and Stats grids. Gallery `preview.src` → `BACKDROP_ORIGINAL_URL`. Remove `loading="lazy"` from `HeroBanner`'s backdrop.
- [x] 7.3 Add `src/components/TrailerEmbed.tsx`: thumbnail button with `aria-label="Play trailer: <name>"` and a play icon, swapping to the `youtube-nocookie` iframe with `autoplay=1` on activation. Use it in `MovieDetails.tsx` and `TVShowDetails.tsx`. Use theme tokens, no hex.
- [x] 7.4 `nginx.conf` CSP `img-src` += `https://i.ytimg.com`; update `test_nginx_conf.py`.
- [x] 7.5 Tests: no iframe before activation; Enter/Space and click load and play it; accessible name present.

## 8. Re-render scope and DB connections

- [x] 8.1 `App.tsx` reads `theme`/`clearGenres` from `useUIContext()` instead of `useAppContext()`.
- [x] 8.2 `settings.py`: `CONN_MAX_AGE = 0 if DEBUG else int(os.environ.get("CONN_MAX_AGE", "60"))`. Settings test for both branches.

## 9. Docs

- [x] 9.1 CLAUDE.md:
  - dev is same-origin through the CRA proxy (the `X-Timezone`/CORS note, the base-URL wording)
  - the TMDB proxy cache: `tmdb` alias, TTLs, bypass rules
  - `tmdb.ts` in-flight sharing
  - detail pages make one combined request (the "Detail-page sections" convention)
  - `POSTER_URL`/`BACKDROP_URL`/`TrailerEmbed` in the shared UI constants and components
  - `fetchAllPages` `pageSize`
- [x] 9.2 `docs/ARCHITECTURE.md`: rationale bullets for each decision in design.md (proxy over a client mapping, a separate cache alias, `append_to_response`, page size 500, `CONN_MAX_AGE` prod-only).
- [x] 9.3 `docs/BUG_BACKLOG.md`: item 26 → 📝 with a link to this change; note the psycopg 3 pool, the watched index and parallel pages as remaining.

## 10. Verification

- [x] 10.1 `npm run typecheck`, `npm run lint`, Jest.
- [x] 10.2 Backend pytest (one process at a time), `ruff check backend/`, `makemigrations --check --dry-run`.
- [x] 10.3 TS Playwright (`--workers=1`) and Python e2e, file by file.
- [x] 10.4 Re-run the task 1.1 measurement and compare. Expect no preflights, 1 TMDB call per detail page in dev, a faster repeat visit (`X-Cache: HIT`), and 3 watched requests for about 1,300 entries. Then delete the script and the throwaway account.
- [x] 10.5 Live check under `npm start`: Movies, a detail page with trailers (thumbnail then play), an avatar, Watched, Stats; light and dark; phone width. No console errors.
