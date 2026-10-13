## 1. Detail page facts and Where to Watch

- [x] 1.1 Guard runtime (`MovieDetails.tsx`) and season/episode counts (`TVShowDetails.tsx`) with `> 0` checks so `0`/missing hides the fact; unit test that runtime `0` renders no `0`
- [x] 1.2 `WatchProviders.tsx`: render a "Buy" section; show "Not available to stream, rent or buy in the US." when no section has providers (missing US entry, empty lists, `{}`); unit tests for buy-only and no-US cases

## 2. Cards and controls become links

- [x] 2.1 `Movie.tsx`/`TVShowCard.tsx`: wrap the poster in `CardLink` (`to` = `/movie/:id` / `/tv/:id`, `onNavigate` = existing `onKnowMore`, `stopPropagation`, `label` = title); keep card click and Details button
- [x] 2.2 `HeroBanner.tsx`: "View Details" becomes an antd `Button` with `href={detailPath}`; plain click → `preventDefault`, `onBeforeNavigate`, `navigate`; modifier/middle click falls through
- [x] 2.3 `NotificationBell.tsx`: replace the `role="button"` item div with `CardLink` (`to` = title path, `onNavigate={() => openItem(item)}`), drop the hand-rolled key handler; keep unread styling
- [x] 2.4 Tests: browse card poster is a link with the right href and Enter/plain click still stashes return state; hero and notification items expose links; update `CLAUDE.md`'s CardLink bullet to list the browse grid cards, hero and notification items

## 3. Back target from recommendation cards

- [x] 3.1 `RecommendationsPage.tsx`: add a `from` prop (default `"/recommendations"`) to `SectionRow` and `RecCard`, used by the card click, `CardLink` state and Details button
- [x] 3.2 `FollowingPage.tsx`: pass `from="/following"`; test that a Following rec card navigates with `state.from === "/following"`

## 4. Mark as Watched runtime

- [x] 4.1 Add and export `prefillRuntime(mediaType, details)` (movie: positive `runtime`; TV: `number_of_episodes × (episode_run_time[0] || last_episode_to_air.runtime)` when both positive; else `undefined`); add `last_episode_to_air` to the TV detail type if missing; unit tests for the spec scenarios
- [x] 4.2 `MarkWatchedModal.tsx`: load via `fetchMovieDetails`/`fetchTVDetails` only, read `watch/providers` through `objectOr`, prefill with `prefillRuntime`; a malformed providers part still prefills runtime with only "Other" offered; a failed details call leaves the dialog usable
- [x] 4.3 Make the runtime `InputNumber` editable (`min={0}`, `precision={0}`, no `disabled`); confirmed value is what `onConfirm` receives; test a user edit is kept
- [x] 4.4 Remove now-unused `fetchMovieProviders`/`fetchTVWatchProviders` from `src/api/tmdb.ts`; update e2e specs/mocks (`e2e/movies.spec.ts`, `e2e/python/conftest.py`, `e2e/python/test_detail.py`) that relied on the `/watch/providers` route for the mark-watched flow
- [x] 4.5 Update `CLAUDE.md`'s Mark as Watched bullet (one details request, editable runtime, TV prefill rule)

## 5. Person crew credits

- [x] 5.1 `MediaCardGrid.tsx`: optional per-item `mediaType` overriding the grid's (key items by type+id)
- [x] 5.2 `PersonPage.tsx`: `mergeCrew()` over movie and TV `.crew` (one entry per type+id, distinct jobs joined with ", "), a "Crew (N)" tab with per-item media type; hide when empty
- [x] 5.3 Sort Movies, TV and Crew tabs newest first by `release_date`/`first_air_date`, undated last (shared comparator)
- [x] 5.4 Default tab: `crew` when `known_for_department` isn't "Acting" and crew exists, else first non-empty tab; explicit `?tab=` wins; "No credits available" only when all credit tabs are empty
- [x] 5.5 Disable the Follow button while `useFollowedPeople().error` is set
- [x] 5.6 Tests: director opens on Crew with joined jobs, crew-only person, date order, Follow disabled on error

## 6. Navigation state and shared hooks

- [x] 6.1 `usePaginatedFetch.ts`: extract `loadMore`'s id-dedupe into a helper and apply it to the multi-page restore `flatMap`; test a title on two restored pages renders once
- [x] 6.2 `useNotifications.ts`: `seenEpochRef` bumped by `markSeen`; `refresh` drops a response whose request started before the latest mark-seen; test the in-flight poll scenario
- [x] 6.3 `useLocalStorage.ts`: same-tab sync via a `cinedb-local-storage` `CustomEvent` (writer skips its own event, next value computed outside the state updater); test two instances on one key, and that recent searches added in one `SearchBox` appear in another
- [x] 6.4 `WatchlistPage.tsx`: restore scroll only when `location.state.isReturn` (set by the detail page's Back and by `stashReturnState` for browser Back), scroll position carried in router state instead of sessionStorage; test both paths
- [x] 6.5 `FollowingPage.tsx`: recs effect keyed on the sorted joined followed ids instead of `followed.length`; test follow-one-unfollow-one refetches

## 7. Browse hero and hide-watched

- [x] 7.1 `HeroBanner.tsx`: replace `requireGenreId` with optional `discoverParams`; `AnimePage.tsx` passes `with_keywords: ANIME_KEYWORD`, `sort_by: "popularity.desc"`; no result → no hero (no fallback to a non-anime title); update e2e mocks if the Anime hero now hits `/discover/**`
- [x] 7.2 Add a test pinning that browse grids hide watched titles outside search and show them with a search term; add the rationale bullet to `docs/ARCHITECTURE.md`

## 8. Dialogs, CSV and small fixes

- [x] 8.1 `AddToListModal.tsx`: reset search and new-name on open; show a spinner while lists load, `LoadError` with `reloadLists` on failure, "No lists yet" only when loaded and empty; tests
- [x] 8.2 `CSVUploadModal.tsx`: templates list only columns `parseCSVForImport` reads (check the parser for any beyond `id`/`title`/`type`)
- [x] 8.3 `utils/export.ts`: `buildCSVString` prepends a UTF-8 BOM; round-trip tests through `parseCSV`, `parseCSVForImport` and `parseBackupCSV` (header name has no stray BOM)
- [x] 8.4 `TMDBCallbackPage.tsx`: wrap the `Spin` around a min-height container so its `tip` renders

## 9. Verify and document

- [x] 9.1 `npm run typecheck`, `npm run lint`, Jest suite, `npx playwright test` all pass
- [x] 9.2 Live check with `npm run dev` + Playwright: movie with runtime 0 (no `0`), browse poster Ctrl-click opens new tab, Following → detail → Back lands on Following, a director's person page opens on Crew, TV Mark as Watched prefills episodes × runtime and accepts an edit; delete `verify_*` scripts afterwards
- [x] 9.3 Update `docs/BUG_BACKLOG.md`: item 19 status to 📝/✅ as appropriate, resolve the three (19) open decisions, note the HeroBanner lazy item was already fixed by 26
