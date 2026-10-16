## Context

See proposal.md for the findings. Current state:

- `useWatched` keeps the loaded list when a reload fails and sets `error`; `loadedGen` is set in `finally`, so `isLoading` turns false after a failed first load and after a failed background reload alike. Nothing tells "never loaded" apart from "reload failed".
- `WatchlistPage` (item 43) renders `LoadError` whenever the filter is on and `watchedError` is set, and renders the filtered grid while `watchedLoading` is true.
- `parseBackupCSV` bounds poster and score only; runtime is `parseInt`, platform/zone/review/title unbounded, timestamps passed as is, `user_rating` any number. `parseCSVForImport` already bounds runtime (`/^\d+$/` ≤ `MAX_RUNTIME`), platform (≤ 100) and watched time (`normalizeWatchedAt`), but not title. A rating row whose `userRating` is undefined is already skipped by `CSVImportAllModal` (`ratings.filter((r) => r.userRating !== undefined)`).
- `detailPageTitle` returns the error heading when `!name`. Detail and person routes are `<Route path="/movie/:id" element={<ErrorBoundary><MovieDetailPage /></ErrorBoundary>} />`, and the review read that an id change reuses the instance and renders once with the old record and `loading` false (see decision 4: `App.tsx` keys `<Routes>` on the pathname, so it doesn't).

## Goals / Non-Goals

**Goals:**
- One per-column rule set used by both CSV readers.
- The Watchlist filter distinguishes loading, never-loaded failure and a failed reload of loaded data.

**Non-Goals:**
- Looking up a backup row's score (decided: keep 0).
- Changing `useWatchlist`/`useRatings`/`useLists` (no page filters on them yet).
- Server-side changes: the serializers stay the reference for the bounds.

## Decisions

### 1. `useWatched` exposes `hasLoaded`
A `loadedOkGen` state set to the session generation in the success path of `reload` (beside `setError(null)`); `hasLoaded = loadedOkGen === currentSessionGeneration()`, so sign-out resets it the same way `isLoading` works. `WatchedContext` passes it through. The Watchlist, with the filter on:
- `!hasLoaded && watchedError` → `LoadError` with Retry (as in 43);
- `!hasLoaded` otherwise → the page's `SkeletonCard` placeholder;
- `hasLoaded` → the filtered grid, whatever `watchedError` says.
The clamp's `filterReady` becomes `watchedFilter === "all" || hasLoaded`, which also lets it run after a failed background reload (the data it filters on is real).

*Alternative:* derive "loaded" from `watchedList.length > 0`. An empty history is a valid loaded state, so this would keep a user with no watches on the skeleton. Rejected.

### 2. Per-column parsers in `csvParse.ts`
Next to `parsePosterPath`/`parseScore`: `parseRuntime` (whole number 0..`MAX_RUNTIME`), `parseBoundedText(raw, max)` (trimmed, dropped when longer; used for platform 100 and time zone 64), `parseUserRating` (0.5–10 on a half step), `parseTitle` (trimmed, sliced to 500), and the existing `normalizeWatchedAt` reused for every timestamp column (`added_at`, `watched_at`, `rated_at`; date-only → noon UTC as today). A review over 5,000 is dropped (`row.review` unset), not cut, so a review never ends mid-sentence silently. Constants restate the serializer bounds (`MAX_TITLE_LENGTH`, `MAX_TZ_LENGTH`, `MAX_REVIEW_LENGTH`) with a comment pointing at `serializers.py`. `parseCSVForImport` switches to the same helpers (no behavior change except the title cut).

*Alternative:* raise the server's tolerance (drop bad fields server-side). That changes the all-or-nothing bulk contract and the API. Rejected.

### 3. `detailPageTitle`: error heading only on an error
`if (state.error) return failed`; otherwise `[state.name || headings.generic, { loading: false }]`. Person's render condition `error || !person` is unchanged; with no error and no person it can't be reached after loading settles (the effect always sets one or the other).

### 4. Detail and person routes already remount per id (no change)
Found while implementing: `App.tsx` renders `<Routes location={location} key={location.pathname}>` (for the page transition), so a new id already mounts a fresh page with `loading` true and no record. The review read the pages without `App`. No wrapper is added. A test checks the observable behavior (no settled previous-subject title, no previous content) with `<Routes>` keyed the same way; a one-frame stale render can't be observed from Jest, so the key itself is protected by a comment in `App.tsx` and the CLAUDE.md note, not by the test.

*Alternatives considered:* a `KeyedByParam` wrapper, or a `loadedId !== id` check in each page. Both duplicate what the pathname key already does.

## Risks / Trade-offs

- [Someone removes the pathname key from `<Routes>` (it reads as a transition detail)] → a comment on it and CLAUDE.md name it as load-bearing; the test only covers the settled behavior.
- [Skeleton under the filter makes a slow watched load look like a slow watchlist] → it's the same loading state the page uses for its own first load, and it lasts only until the history arrives.
- [Title cut at 500 characters] → only reachable with hand-made files; the server would reject the row otherwise.
