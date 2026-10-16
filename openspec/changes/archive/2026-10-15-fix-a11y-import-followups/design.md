## Context

See proposal.md for why. All seven fixes are frontend-only and independent of each other, apart from the announcer, which needs a small change to `usePageTitle`'s contract. Current state that shapes the approach:

- `usePageTitle(name)` sets `document.title` in an effect and notifies module-level listeners. Its unmount cleanup resets the title to "CINE DB" without notifying. Detail and person pages pass a generic name ("Movie", "TV Show", "Person") until their fetch lands, and nothing tells a listener whether that name is final.
- `RouteAnnouncer` marks a navigation as pending on a pathname change and announces `latest` after `ANNOUNCE_SETTLE_MS` (1 s), restarting the timer on each title change. `latest` keeps whatever was last emitted, which can be the previous page's title. A `first` ref skips the initial load, but StrictMode's effect replay consumes it.
- `renderCertifications` maps every `release_dates.results` entry with `c.release_dates.find(...)`. `resultsOf` only guarantees the outer array.
- `WatchlistPage`'s clamp effect waits for `useWatchlistContext().isLoading`/`error` only, while the `extraFilter` reads `isWatched` from `WatchedContext`.
- `MarkWatchedModal`'s single fetch effect depends on `userRegion` and calls `form.resetFields()`/`setFieldsValue` on every run.
- `CSVUploadModal` runs `lookupImportPosters` over every parsed row. `parseCSVForImport` reads `poster_path` without a length check and doesn't read `vote_average`.

## Goals / Non-Goals

**Goals:**
- Announce exactly one title per navigation: the new page's settled one.
- Keep each fix local to the file that has the bug. No new shared abstractions beyond the `usePageTitle` option.

**Non-Goals:**
- A shared Watchlist/Watched pagination hook (deferred until a third caller, per CLAUDE.md).
- Showing a watched-history load error on the Watchlist. With that load failed, the clamp simply doesn't run.
- A timeout that announces something for a route whose code never loads. The ErrorBoundary page has no title to announce.

## Decisions

### Page titles say whether they're final

`usePageTitle(name, { loading })` gains an optional `loading` flag, which is false by default, so the many pages with a fixed name don't change. Detail, person and list pages pass their own loading state (`MovieDetailPage`/`TVDetailPage`/`PersonPage`: `loading`; `ListDetailPage`: the lists context's `isLoading`). On a failed load they pass `loading: false`, so the generic title is final and gets announced. The effect depends on `[title, loading]`, so a load that ends without changing the title (a failure) still notifies. The unmount cleanup also notifies, with a "cleared" event. In one commit React runs all passive cleanups before any passive mounts, so the old page's clear always reaches listeners before the new page's title, whatever the tree order.

**Alternative considered:** tag each emission with the router pathname (`useLocation()` inside the hook) and accept only matching ones. That's rejected because it makes `usePageTitle` throw outside a router and would break unit tests that render a page bare. It also doesn't solve the "generic title while loading" half.

### The announcer waits for a final title

The announcer keeps the latest emission (`{ title, loading }` or cleared). After a pathname change it is pending. It starts the settle timer only while the latest emission is a non-loading title, cancels it on a cleared or loading emission, and restarts it on another final title. A same-component param change (`/movie/1` → `/movie/2`) first commits with the old final title still current. The page's effect then resets to loading within the settle window, which cancels the timer, so the old name isn't announced. The settle time stays 1 s to absorb that.

For the first load, a `lastPath` ref is initialised to the first pathname, and the effect returns early while `pathname === lastPath.current`, updating it otherwise. StrictMode's replay sees the same pathname and does nothing. A real A → B → A sequence still announces, because the ref has moved on to B.

### Each fix stays in its own file

- **Certification:** `arrayOr<ReleaseDate>(c?.release_dates).find(...)`, plus `c?.iso_3166_1`, so a null entry is skipped too.
- **Watchlist clamp:** `const filterReady = watchedFilter === "all" || (!watchedLoading && !watchedError)` is added to the effect's condition and deps, reading `isLoading`/`error` from `useWatchedContext()`.
- **Mark as Watched:** the fetch effect stores the providers' `results` object in state and no longer depends on `userRegion`. The platform `options` are a `useMemo` over that state and `userRegion`. A region change then only recomputes options. If the currently selected platform is no longer offered, it stays as entered: the Select shows its value and the save still carries it. That matches "anything else the user entered is kept".
- **CSV import:** `parseCSVForImport` drops a `poster_path` longer than `MAX_POSTER_PATH_LENGTH` (500, the serializers' `max_length`). It reads `vote_average` when it's a finite number within the bulk serializer's bounds. `CSVUploadModal` looks up only the rows missing a poster or a score, maps the results back by original index, and uses the file's value before the lookup's for each field. The "saved without a poster" count becomes the number of rows whose final poster is null. That count is now right for rows that had a poster in the file but whose score lookup failed.
- **Reduced motion:** `StatsPage` reads `useReducedMotion()` in the page component and passes `isAnimationActive={!reduceMotion}` to every `Pie`/`Bar`/`Area`. `WatchlistPage`, `WatchedPage` and `CalendarPage` use `behavior: reduceMotion ? "auto" : "smooth"`. A CSS `scroll-behavior` rule can't override an explicit JS `behavior`, which is why each call site has to check.

## Risks / Trade-offs

- [A page passes `loading: true` and never clears it, for example a new page copying the pattern wrongly] → that page's navigation is never announced. Mitigation: Jest covers the failed-load path on the announcer, and the option's doc comment says to pass `false` once the load settles either way.
- [A route's lazy chunk fails to load] → nothing is announced, because the ErrorBoundary has no title. That's accepted: announcing the previous page would be worse.
- [The import trusts the file's score] → an edited CSV can carry any in-bounds score. That's the same trust the file's poster already gets, and the score is TMDB's public rating, not user data.
