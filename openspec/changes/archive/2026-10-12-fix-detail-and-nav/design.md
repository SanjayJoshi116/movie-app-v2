## Context

See proposal.md for the bug list and the three product decisions. All work is frontend. Most fixes are local, but a few touch shared building blocks that other pages rely on: `CardLink`, `MediaCardGrid`, `useLocalStorage`, `usePaginatedFetch`, `buildCSVString`, `HeroBanner` and `RecCard`/`SectionRow`. The detail pages already load everything in one appended TMDB request (`fetchMovieDetails`/`fetchTVDetails`, including `watch/providers`), served through `sharedGet` and the proxy's 6 h cache.

## Goals / Non-Goals

**Goals:**
- Reuse the existing conventions (`CardLink` + `onNavigate`, `objectOr`/`arrayOr`, `stashReturnState`, `sharedGet`) rather than add new mechanisms.
- Keep every fix small enough to unit-test in isolation.

**Non-Goals:**
- Changing which titles the browse grids hide (decided: keep it, document it).
- A region picker for Where to Watch. It stays US, but now says so.
- Per-episode watch tracking. A TV watch stays a single entry with one runtime.
- Backend changes. `runtimeMinutes` already accepts any non-negative int32.

## Decisions

**1. Browse cards: poster-only `CardLink` with `onNavigate`.**
- `Movie.tsx`/`TVShowCard.tsx` have their own buttons, so per the accessibility rule only the poster becomes the link. The card-level mouse `onClick` stays, so the CardLink passes `stopPropagation`.
- The link's `to` is the real `/movie/:id` or `/tv/:id` (fixed per component, since Anime movies render `Movie` and Anime TV renders `TVShowCard`). `onNavigate` calls the page's existing `handleKnowMore`, which stashes the return state and navigates with router state.
- Modifier clicks open `to` natively and leave the page untouched, so nothing needs stashing.
- Alternative considered: making the whole card a link. Rejected, because nested buttons are invalid inside a link.

**2. Hero "View Details": antd `Button` with `href`.**
- A plain click is intercepted (`preventDefault`, `onBeforeNavigate`, `navigate`). Modifier and middle clicks fall through to the native `<a>`.
- This keeps the button styling with real link semantics. `CardLink` would lose the antd button look.

**3. Notification items: `CardLink` with `onNavigate={() => openItem(item)}`.**
- This replaces the `role="button"` div and its hand-rolled key handler. `openItem` already closes the dropdown and navigates.

**4. Back target for recommendation cards.**
- `SectionRow` and `RecCard` take a `from` prop, defaulting to `"/recommendations"`. `FollowingPage` passes `"/following"`.
- Every navigation in `RecCard` (the card click, the CardLink `state` and the Details button) uses it.

**5. MarkWatchedModal: one request, a pure prefill function.**
- The modal calls `fetchMovieDetails`/`fetchTVDetails`, which already append `watch/providers`, and reads the providers through `objectOr`. This drops the separate provider request.
- It also fixes "a providers failure discards the runtime", because there is no second promise to fail.
- It is often a free hit: the same URL as the detail page means `sharedGet` dedupe plus the proxy cache.
- `fetchMovieProviders`/`fetchTVWatchProviders` lose their last caller and are removed.
- The runtime prefill is an exported pure function, `prefillRuntime(mediaType, details)`:
  - movie: `runtime > 0 ? runtime : undefined`.
  - TV: `number_of_episodes × (episode_run_time[0] || last_episode_to_air.runtime)` when both are positive.
- The `InputNumber` loses `disabled` and gets `min={0} precision={0}`.
- Alternative considered: keeping two requests with `allSettled`. Rejected, since the append is already paid for.

**6. Person crew tab.**
- `movie_credits`/`tv_credits` already return `.crew`, so no new request is needed. A `mergeCrew()` helper merges both lists keyed by `${media_type}-${id}`, joining distinct `job`s with ", ".
- `MediaCardGrid` items gain an optional per-item `mediaType`, which overrides the grid's, so one grid can mix movies and TV.
- A shared `byDateDesc` comparator (on `release_date`, then `first_air_date`; empty dates last) sorts all three credit tabs.
- The default tab is `crew` when `known_for_department !== "Acting"` and crew credits exist. Otherwise it is the first non-empty tab, and an explicit `?tab=` still wins.
- Alternative considered: `combined_credits` in a single request. Deferred, since it would change the e2e mocks for no user-visible gain here.

**7. Notifications: a mark-seen epoch.**
- `useNotificationsState` keeps a `seenEpochRef`, which `markSeen` increments.
- `refresh` captures it before the `await` and drops the response if it changed, as it already does for `isCurrentSession(gen)`. The next scheduled poll shows the server's real state.
- Alternative considered: patching the stale response to read-only. Rejected, because a drop is simpler and the poll comes again.

**8. Same-tab sync in `useLocalStorage`.**
- After writing, `setValue` dispatches a `CustomEvent("cinedb-local-storage", { detail: { key, value } })` on `window`. Every instance with that key, other than the writer, adopts the value. The existing cross-tab `storage` listener stays.
- The next value is computed outside the React state updater, using a ref holding the latest value, so StrictMode's double-invoked updater can't dispatch twice.
- This fixes recent searches and also keeps any other duplicated key (theme, sidebar) consistent.
- Alternative considered: a RecentSearches context. Rejected as more wiring for the same result.

**9. Watchlist scroll restore only on return.**
- Opening a title stashes `{ scrollY, isReturn: true }` into the Watchlist's own history entry with `stashReturnState()`, and passes `scrollY` in the detail page's router state, which its in-app Back already echoes with `isReturn`. The page restores only when `location.state.isReturn` is set, so the `watchlist_scroll` sessionStorage key goes away.
- Rejected during implementation: `useNavigationType() === "POP"`. `App.tsx` passes `location` to `<Routes>`, and React Router then reports every in-route navigation as POP, so a sidebar visit looked like a Back.

**10. Restore dedupe in `usePaginatedFetch`.**
- `loadMore`'s id-dedupe is extracted into a small helper. The multi-page restore path runs `flatMap` through it.

**11. Anime hero source.**
- `HeroBanner` replaces `requireGenreId` with an optional `discoverParams`. When given, it calls discover with those params (Anime passes `with_keywords: ANIME_KEYWORD`, `sort_by: popularity.desc`) and takes the first result. With no result there is no hero.
- Home keeps trending plus `excludeGenreId`.

**12. CSV BOM in `buildCSVString`.**
- Prepending `﻿` there covers every exported CSV, including ZIP members. `parseCSV` already strips a leading BOM.
- A test pins the round trip through `parseCSV`, `parseCSVForImport` and `parseBackupCSV`.

**13. Small items.**
- **Stray `0`:** `> 0` guards.
- **WatchProviders:** add a Buy section; when no section renders, show "Not available to stream, rent or buy in the US."
- **AddToListModal:** reset its text in an effect on `open`, and branch on `isLoading`/`error` from `useListsContext()` (`LoadError` with `reloadLists`).
- **FollowingPage recs effect:** key on the sorted joined `personId`s.
- **PersonPage Follow:** `disabled={!!error}` from `useFollowedPeople()`.
- **CSV templates:** reduced to the parser's columns (`id,title,type`).
- **TMDBCallbackPage:** `Spin` wraps a min-height container so `tip` renders.

## Risks / Trade-offs

- [Risk] The MarkWatchedModal details payload is larger than the old providers-only call. → It is cached and shared with the detail page, and it saves one request per open.
- [Risk] The same-tab storage event changes a hook that the theme and sidebar collapse also use. → Writers skip their own event, values are JSON round-tripped exactly as now, and a unit test covers two instances on one key.
- [Risk] A `prefillRuntime` for a long-running show can be large (e.g. 1000 episodes × 22 min). → It is editable and the backend accepts int32, which is acceptable.
- [Risk] e2e specs mocking `/watch/providers` for the mark-watched flow no longer get that call, and the strict catch-all doesn't fail on unused mocks. → The tasks update those specs to assert on the details route instead.
- [Risk] Dropping a notifications response after mark-seen can delay a genuinely new item by one poll interval (3 min). → Acceptable for a background poll.

## Migration Plan

There is no data migration. This is a frontend deploy only, and rollback is a revert.
