## Context

See proposal.md for the bug list. The parts of the current code that shape the approach:

- **Filter state is split three ways:**
  - Applied filters and sort live in `App.tsx` (`activeFilters`, `activeSortBy`) and survive every route change.
  - The panel's draft inputs are local `useState` in `FilterPanel`. That component only mounts on browse routes, so its draft resets whenever the user opens a detail page. Meanwhile the applied filters stay put, which is a mismatch even today.
  - Genres are a third store: `selectedGenres` in `UIContext`. They apply live (they're in `fetchPage`'s deps) and are cleared by `HomePage`/`AnimePage` on any non-return mount.
- **There's one genre list:** `src/constants/genres.ts` is TMDB's movie list.
- **Browse restore relies on `location.state.isReturn`.** Only the in-app Back button (`MovieDetails`/`TVShowDetails` `navigate(from, { state: { …, isReturn: true } })`) sets it. Browser Back pops the browse page's original history entry, whose state was `null` or `isReturn: false`.
- **The API already sorts watched newest-first** (`watched_views.py` `order_by("-watched_at", "-id")`). Only the optimistic insert in `useWatched.addRaw` disagrees with it.
- **The responsive and restore conventions in CLAUDE.md still apply:**
  - no JS width checks
  - unmount cache writes go through `saveSessionCache`
  - don't remove `usePaginatedFetch`'s StrictMode guard

## Goals / Non-Goals

**Goals:**
- One place decides whether "filters are active", and one place maps filters to TMDB params per media type.
- The draft filters, applied filters and genres all reset together when the browse media type changes, and all survive a trip to a detail page and back.

**Non-Goals:**
- Fetching genre lists from TMDB at runtime (`fetchMovieGenres`/`fetchTVGenres` exist but stay unused). The lists are stable and a static constant avoids a request plus a loading state in the panel.
- Persisting browse filters across reloads or sessions.
- Fixing UTC vs local dates in general (backlog #5). Anime "Airing Today" uses the browser's local date, which is the direction #5 is expected to take anyway.
- Moving `RecommendationsPage` onto `useLibraryFilters` (CLAUDE.md says it stays off).

## Decisions

### D1. Add a static TV genre list and pick the list by media type
Add `tvGenres` to `src/constants/genres.ts` (TMDB `/genre/tv/list`: 10759 Action & Adventure, 16 Animation, 35 Comedy, 80 Crime, 99 Documentary, 18 Drama, 10751 Family, 10762 Kids, 9648 Mystery, 10763 News, 10764 Reality, 10765 Sci-Fi & Fantasy, 10766 Soap, 10767 Talk, 10768 War & Politics, 37 Western). Rename the existing export to `movieGenres`. `FilterPanel` already receives `isMovie`, so it renders `isMovie ? movieGenres : tvGenres`.
*Alternative:* map movie ids to TV ids (28 → 10759) and keep one list. Rejected: the lists don't line up one-to-one (no TV Horror/Thriller/Romance), so the UI would offer genres that never match.

### D2. A single browse "filter scope" in `App.tsx` drives every reset
Derive `filterScope: "movie" | "tv" | "anime-tv" | "anime-movies" | null` from the pathname plus `animeMediaType` (`browseScope()`). It's `null` off browse pages. `App.tsx` keeps an `appliedScope` state that only follows non-null scopes. When a non-null scope differs from it, these happen **during render** (the "adjust state while rendering" pattern):
- reset `activeFilters` to `null`
- reset `activeSortBy` to the default

An effect would be too late: child effects run before the parent's, so the newly mounted page would fetch once with the old scope's filters. Genres live in `UIContext`, a parent provider that can't be updated during this render, so `clearGenres()` runs in an effect on `appliedScope`. Pages also filter the selected ids through `genresFor(mediaType, ids)`, so that first fetch can never carry another media type's genre id.

Going Movies → detail → Movies passes through `null`, so nothing resets and the restore keeps its filters.

To keep the panel in sync, `FilterPanel` takes the applied values as props (`appliedFilters`, `appliedSortBy`) and seeds its draft from them. It is rendered with `key={filterScope}`, so a scope change remounts it with fresh defaults. It also remounts with the applied values after a detail-page round trip, which fixes today's mismatch between panel and grid.
*Alternative:* keep applied filters per scope in a map, so switching back to Movies restores the old Movies filters. Rejected: the spec says switching media type resets, and a hidden per-scope memory is the confusion we're removing.

### D3. `hasActiveFilters` and the fetch branch live in one util
Add `src/utils/browseFilters.ts` with `hasActiveFilters(filters, sortBy, genres)`:
- true if any of `yearFrom`/`yearTo`/`minRating`/`maxRating`/`language`/`minRuntime`/`maxRuntime` is non-empty, or `sortBy !== "popularity.desc"`, or `genres.length > 0`
- `includeAdult` is ignored

`HomePage`, `AnimePage` and their `hasFilters` UI flags all call it. When it returns true, the page fetches through discover with `filtersToTMDBParams(...)` plus `with_genres`. Category branches build their params without `with_genres`. This one predicate fixes both "Apply disables categories" and "genres sent to category endpoints".

### D4. `filtersToTMDBParams` owns per-media-type param rules
For `mediaType === "tv"`:
- map `original_title.asc` → `original_name.asc` (the existing `primary_release_date` → `first_air_date` rewrite stays)
- drop `with_runtime.*`

The second rule is a backstop: D2 already resets the hidden runtime, but the util shouldn't trust that. Unit tests cover the mapping.

### D5. Anime "Airing Today" filters by air date
Replace the `SORT_MAP` entry for `anime-tv-airing` with discover params `air_date.gte = air_date.lte = <local today yyyy-mm-dd>` and `sort_by: popularity.desc`. Build the date from `getFullYear/getMonth/getDate`, not `toISOString()`. TMDB's `/tv/airing_today` can't be used because it ignores `with_keywords` (the anime keyword).

### D6. Browser Back: write restore state into the browse entry before leaving
Add `src/utils/browseReturnState.ts` with `stashReturnState(state)`. It merges `state` into the current history entry with a raw `window.history.replaceState({ ...cur, usr: { ...cur.usr, ...state } }, "")`, keeping the router's `key`/`idx`.

In `handleKnowMore` (Home, Anime), and in any other browse → detail navigation that already passes `from`, call `stashReturnState({ scrollY, loadedPages, activeCategory, isReturn: true })` and then push the detail route as today.

How each path behaves:
- **Browser Back** fires `popstate`. React Router (`BrowserRouter`, v6.24) rebuilds `location.state` from `history.state.usr` (`@remix-run/router` `createBrowserHistory`), so the page sees `isReturn: true`. That's the same path the in-app Back button takes.
- **The stash itself:** raw `replaceState` emits no event, so React does not re-render between the click and the navigation. No effect reruns, so the StrictMode double-run guard in `usePaginatedFetch` is never involved.
- **A sidebar link** pushes a new entry with `usr: null`, so fresh visits still reset.

*Alternative A:* `navigate(location.pathname + location.search, { replace: true, state })` before the push. Rejected: it re-renders the browse page, with `isReturn` flipping to true, just before it navigates away. That would need proof that it triggers no refetch or scroll jump under StrictMode, so it's risk with no gain.
*Alternative B:* persist browse state in sessionStorage keyed by pathname, as Search does. Rejected: it can't tell "came back" from "clicked the sidebar link" without the history entry, which is the distinction the spec requires.

### D7. Search tabs track their own scroll
Each tab component gets an `active` prop. While active, a passive `scroll` listener keeps that tab's `scrollYRef` current. The unmount save writes `scrollYRef.current` rather than reading `window.scrollY` at unmount time. When a mounted tab becomes active again, it restores its `scrollYRef` in a layout effect. Inactive tabs therefore keep the position they last had.

### D8. The For You cache records completeness
The unmount save adds `complete: !forYouComputing && !personalizedComputing && !loading`. `readRecCache` still applies the TTL and the empty-check. An incomplete snapshot (including old snapshots with no `complete` field) seeds the sections but leaves `hasFetched` false and `loading` false, so the fetch/poll effect runs again over the shown data. A complete snapshot behaves as today.

### D9. Small, local fixes
- **List detail:** `ListDetailPage` uses `keyPrefix: \`listdetail_${listId}\``. Routes are keyed by pathname, so a list change remounts the page and `useLibraryFilters`'s lazy initial state reads the right keys.
- **Search trim:** `useLibraryFilters` matches with `search.trim().toLowerCase()`.
- **Watched order:** `useWatched.addRaw` prepends: `[newEntry, ...prev]`.
- **Watched page clamp:** a `WatchedPage` effect computes `lastPage = max(1, ceil(filtered.length / pageSize))` and calls `setPageState(lastPage, pageSize)` when `page > lastPage`. It only runs after the watched list has loaded (`!isLoading && !error`), so a deep link like `?page=3` isn't clamped to 1 against the initial empty list.
- **Login redirect:** `LoginPage` builds `from` as `pathname + search + hash` from `state.from` (`App.tsx` already passes the whole `location`), falling back to `/movies`.

## Risks / Trade-offs

- **[D6 relies on React Router storing route state under `history.state.usr`, which is internal]** → The coupling lives in one helper, with a comment pointing at the router source. A Jest test asserts `stashReturnState` writes `usr` and keeps `key`/`idx`. The Playwright `go_back()` test (task 6.2) fails loudly if a router upgrade renames the field. If it ever does, the fix is confined to the helper body: fall back to Alternative A and add a "no extra network call" assert.
- **[Reloading a browse page whose history entry now says `isReturn: true` restores instead of resetting]** → Acceptable, since it matches what the user was looking at. Loaded pages refetch over the network as they do for the in-app Back button.
- **[The For You resume can briefly show stale sections from the incomplete snapshot]** → Intended. They are replaced as the polls resolve, and the "computing" indicator shows during polling.
- **[Old `listdetail_*` sessionStorage keys are orphaned]** → They're session-scoped and tiny, and they clear when the tab closes. No migration.
- **[The static TV genre list can drift from TMDB]** → TMDB's genre ids have been stable for years, and a stale entry only means one chip returns fewer results.

## Migration Plan

This is frontend only and ships with the next version bump. There is no data migration. Rolling back is a code revert, and the new sessionStorage keys are ignored by the old code.
