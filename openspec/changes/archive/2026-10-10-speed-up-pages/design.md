## Context

See proposal.md (Why) for the measured causes; `docs/BUG_BACKLOG.md` item 26 has the full capture. Relevant current state:

- **Clients.** `userApi.ts`, `tmdb.ts` and `constants/media.ts` default their base URLs to `http://${window.location.hostname}:8000`. Docker builds override all three (`Dockerfile.frontend`: `/api`, `/api/tmdb`, empty media base). nginx serves `/api/` and `/media/` same-origin. No root `.env` sets `REACT_APP_*`.
- **Backend server.** `start.py` runs `runserver 0.0.0.0:8000` (IPv4 only). On the dev machine, `localhost` resolves to `::1` first.
- **Caches.** There's one cache alias, `default`: LocMem under DEBUG, `DatabaseCache` (`cinedb_cache`, `MAX_ENTRIES` 50,000) in prod. It holds throttle counters plus notification and recommendation data. `start.py` and `docker-entrypoint.sh` already run `createcachetable`, which creates every DB-backed alias's table.
- **Pagination.** `DefaultPagination` has `page_size` 100 and `max_page_size` 200, but no `page_size_query_param`, so clients can't change the size.
- **Detail pages.**
  - `MovieDetailPage` makes 5 calls: details with `credits,images,videos,recommendations`, plus reviews, similar, providers and release_dates.
  - `TVDetailPage` makes 6: details with `external_ids,similar,recommendations,videos`, plus credits, aggregate_credits, images, providers and reviews.
  - Both use `Promise.allSettled` with a `cancelled` flag, which drops a stale result but still sends the request.
- **Proxy tests.** `test_tmdb_proxy.py` mocks `_session.get` and repeats identical requests.

## Goals / Non-Goals

**Goals:**
- Remove the dev-only network penalties (IPv6 fallback, preflights) without touching the production topology.
- Cut the TMDB round trips per page view: 1 per detail page, 0 for repeats within the TTL, no StrictMode duplicates.
- Keep every existing contract: proxy responses identical to TMDB's, per-section degradation, per-user throttling, the proxy's time budget, the CSP.

**Non-Goals:**
- A psycopg 3 connection pool in dev (`runserver`'s per-request thread defeats `CONN_MAX_AGE`; that needs a dependency swap, left in backlog item 26).
- Parallel library page fetching, a watched sort index, HTTP/2 in dev.
- Caching app (non-TMDB) API responses, or any client-side persistent cache.

## Decisions

**1. Dev same-origin through CRA's `proxy` field, targeting `http://127.0.0.1:8000`.**
- Client defaults become relative: `/api`, `/api/tmdb`, and `""` for media. Production already sets these values explicitly, so its bundle doesn't change.
- Why the `proxy` field: CRA's custom `src/setupProxy.js` must be JavaScript, and the frontend is TS-only (`allowJs: false`). CRA forwards any non-`text/html` request it can't serve itself. axios sends `application/json, text/plain, */*` and `<img>` sends `image/*`, so `/api/**` and `/media/**` are covered.
- Using `127.0.0.1` sidesteps `localhost` resolution entirely.
- Alternatives considered:
  - Map `localhost` → `127.0.0.1` in the clients. That fixes the IPv6 fallback but keeps every preflight.
  - Bind `runserver` dual-stack (`[::]:8000`). On Windows, `IPV6_V6ONLY` defaults to on, so IPv4 LAN access would break.
  - Drop the token from TMDB calls. That would regress the per-user throttle requirement.
- CORS settings and `X-Timezone` in `CORS_ALLOW_HEADERS` stay, for anyone who points a client at another origin through `REACT_APP_*`.

**2. One detail request via `append_to_response`.**
- Movie appends: `credits,images,videos,recommendations,reviews,similar,watch/providers,release_dates` (8 parts).
- TV appends: `external_ids,similar,recommendations,videos,aggregate_credits,images,reviews,watch/providers` (8 parts; TMDB allows 20). Not `credits` or `content_ratings`: the TV page renders neither. It shows `aggregate_credits` and no rating; the old separate `credits` call was fetched but never read.
- The page maps each appended key (note the literal `"watch/providers"` key) through a guard that yields an empty list or object when the part is absent or not the expected shape. That is the modified "degrade per section" behavior.
- The single-section fetchers (`fetchMovieReviews` etc.) stay exported where other code uses them, such as later review pages.
- The detail types gain optional appended fields.
- Alternative considered: keep separate calls and only cache them. Rejected: that keeps 5–6 round trips on the first visit and 5–6 throttle ticks per view.

**3. In-flight sharing inside `src/api/tmdb.ts`.**
- Every exported fetcher goes through one `sharedGet(url, config)`, keyed by `api.getUri({ url, params })`.
- It keeps a `Map<key, Promise>` and deletes each entry on settle.
- Callers receive the same `AxiosResponse` and only read it (detail pages spread `data` into new objects), so sharing is safe.
- This replaces per-component dev guards: HeroBanner, the detail pages and any future fetch are all covered at one point.
- Sharing doesn't change errors: every waiter sees the same rejection, as it would with separate requests.

**4. Proxy cache in a dedicated `tmdb` cache alias.**
- Dev: LocMem with `MAX_ENTRIES` 1000. Prod: `DatabaseCache` table `tmdb_proxy_cache` with `MAX_ENTRIES` 2000. Most bodies are 10–50 kB, and combined detail bodies 100–300 kB.
- A separate alias means culling never touches throttle counters in `default` (the item-0 lesson).
- Key: `tmdbproxy:` + sha256 of the path and the forwarded parameter list (minus `api_key`), in the order received. That's exactly what upstream receives, so faithful forwarding still holds.
- Value: the parsed JSON body, stored only for status 200. A hit returns `Response(data, status=200)`, which renders the same JSON as a miss. An `X-Cache: HIT|MISS` header aids verification.
- Bypass: any `session_id`/`guest_session_id` parameter, and any `account/` or `authentication/` path.
- TTLs by path:
  - Lists: `^(trending|discover|search)/` and `^(movie|tv|person)/(popular|now_playing|upcoming|top_rated|airing_today|on_the_air)$` → 600 s.
  - `^(genre/|configuration)` → 86,400 s.
  - Everything else → 21,600 s.
- Throttle classes run before the view, so every request still counts.
- Cache reads and writes happen on the request thread (the CLAUDE.md worker-thread rule). A cache backend error (`django.db.Error` for the DB cache) is treated as a miss on read and ignored on write, never a 500.
- Alternative considered: HTTP caching headers plus the browser cache. Rejected: no cross-user benefit, and the responses carry `Authorization`-dependent throttling.

**5. Library page size 500, chosen per call.**
- `DefaultPagination` gains `page_size_query_param = "page_size"` and `max_page_size = 500`; the default stays 100.
- `fetchAllPages(api, url, { pageSize })` passes `page_size` alongside `page`. The watched, watchlist and ratings hooks use 500.
- Lists (with nested items) and followed people keep the default.
- The `-id` tiebreakers already make offset pages stable.

**6. Image sizes.**
- New `POSTER_URL` (`w342`) for grid cards: `Movie`, `TVShowCard`, `MediaCardGrid`, `LibraryItemCard`, Search, Recommendations, Calendar, Lists and Stats.
- `BACKDROP_URL` becomes `w1280`, and a new `BACKDROP_ORIGINAL_URL` serves only `Image` `preview.src`.
- `IMG_URL` (`w500`) stays for the detail poster, the person profile and gallery thumbnails.
- `HeroBanner`'s backdrop drops `loading="lazy"`.

**7. On-demand trailers through a shared `TrailerEmbed` component.**
- Used by both detail components, per the CLAUDE.md shared-sections convention.
- Before activation it renders a `<button aria-label="Play trailer: <name>">` with the `https://i.ytimg.com/vi/<key>/hqdefault.jpg` thumbnail (constant `YT_THUMB_URL` in `constants/ui.ts`) and a play icon.
- On activation it renders the existing `youtube-nocookie` iframe with `?autoplay=1`.
- nginx CSP `img-src` gains `https://i.ytimg.com`, and `test_nginx_conf.py` is updated with it.

**8. `App` reads `useUIContext()`** for `theme`/`clearGenres` instead of `useAppContext()`, so watched, watchlist and ratings updates don't re-render the route tree from the root.

**9. `CONN_MAX_AGE = 0 if DEBUG else int(env("CONN_MAX_AGE", 60))`.**
- It's off in dev and tests: `runserver` threads die after each request, and pytest uses DEBUG.
- `CONN_HEALTH_CHECKS` stays on.
- Background refresh and backfill threads already close their own connections.

## Risks / Trade-offs

- **LAN hostnames rejected in dev.** With `proxy` set, CRA's dev-server host check accepts `localhost` and the machine's LAN IP, but rejects other hostnames ("Invalid Host header"). → Document opening the dev app on a LAN device by IP. This is dev-only.
- **One shared anon throttle bucket in dev.** All proxied dev traffic arrives from 127.0.0.1, so anon throttles (login, register) are shared by every dev device. → Acceptable in dev; signed-in TMDB calls stay per user.
- **Stale TMDB data within the TTL**, e.g. watch providers up to 6 h, trending up to 10 min. → TTLs sized to how often each kind changes; restarting the process clears LocMem.
- **Concurrent cache misses** for the same key both reach TMDB (no stampede lock). → Rare, bounded by the in-flight sharing on each client.
- **Larger single detail response.** It's all-or-nothing on transport failure, but details were already essential, so the user-visible outcome is unchanged.
- **DB cache cost in prod.** Each proxy call adds a cache-table query. → Milliseconds against 300–1,300 ms of TMDB time, on a now-persistent connection.
- **Tests.** Existing proxy tests repeat identical requests against a mock. → Clear the `tmdb` cache in their `setUp` and add dedicated cache tests. The e2e detail mocks must move to the combined shape, or the pages render empty sections.

## Migration Plan

- No schema migration. The new cache table is created by the existing `createcachetable` step on both dev boot and container start.
- Deploy ships the new nginx CSP with the frontend image. Docker checks stay waived on this machine, as before; `test_nginx_conf.py` covers the config statically.
- Rollback: revert the commit. The leftover `tmdb_proxy_cache` table is harmless.
- Developers: restart `npm start` once so CRA picks up `proxy`.
