## 1. Shared building blocks

- [x] 1.1 Add `src/utils/inflight.ts` (`createInflight()` → `run(key, fn)` returning the pending promise for a repeated key, cleared on settle) with Jest tests (dedupe same key, independent keys, cleared after rejection)
- [x] 1.2 `useToast`: pass `key: msg` so identical messages replace instead of stacking (signature unchanged)
- [x] 1.3 Add `src/components/LoadError.tsx` (antd `Result`, `error`/`notFound` variants, optional `onRetry` → Retry button)
- [x] 1.4 `types/context.ts`: change watchlist/watched/rating mutations in `AppContextType` and `deleteList`/`addToList`/`removeFromList` in `ListsContextType` to return `Promise<...>`; run `npx tsc --noEmit`

## 2. Library hooks: load state

- [x] 2.1 `useWatched`: `isLoading` initial = `isAuthenticated`; one shared loader for effect + `reload` that sets/clears `error` and keeps existing items on reload failure; expose `error`
- [x] 2.2 Same for `useWatchlist`
- [x] 2.3 Same for `useRatings`
- [x] 2.4 Same for `useLists`; add `error`/`reload` to `ListsContextType`
- [x] 2.5 Expose `watchlistError`/`watchedError`/`ratingsError` + reloads through `useAppContext`; grep `isDataLoading` consumers and confirm no new first-frame flash regressions
- [x] 2.6 Extend `hooks/__tests__` (useWatchlist, useRatings, + new useWatched/useLists tests): initial loading when authenticated, error on failed load, items kept on failed reload

## 3. Library hooks: in-flight guard

- [x] 3.1 Wrap `useWatched` add/remove/toggle in a per-`${type}-${id}` inflight runner
- [x] 3.2 Same for `useWatchlist`
- [x] 3.3 `useLists`: inflight per list-item for add/remove, per list for delete/clear
- [x] 3.4 Tests: double `toggle` on the same item issues one POST; different items issue two

## 4. Library pages

- [x] 4.1 `WatchlistPage`: skeleton while loading / `LoadError` with retry / empty CTA / content; await `toggleWatched` (:301) and wrap `clearAll` (:116) in try/catch with toast
- [x] 4.2 `WatchedPage`: same state branching; await `removeFromWatched` (:201) with try/catch
- [x] 4.3 `ListDetailPage`: loading placeholder instead of "List not found." before lists load, `LoadError` on failure; try/catch for `clearList` (:133), `deleteList` (:145), await + catch `removeFromList` (:218)
- [x] 4.4 `AddToListModal`: confirm add/remove (:95/:98) is awaited with error toast

## 5. Paginated grids

- [x] 5.1 `usePaginatedFetch`: generation ref bumped on `fetchPage` change; clear items when starting a new page-1 fetch (after the StrictMode replay guard, never on `restoredState` seed); discard stale page-1/`loadMore` results; block `loadMore` while page 1 loads; expose `error` + `retry()`; `loadMore` failure → keep items + toast at call site
- [x] 5.2 Render `LoadError` with retry on page-1 error in HomePage, AnimePage, PeoplePage and SearchPage
- [x] 5.3 Jest tests for `usePaginatedFetch`: stale loadMore discarded after `fetchPage` change, error set on page-1 failure, restored state not cleared

## 6. Stats, detail and person pages

- [x] 6.1 `StatsPage`: separate `error` state from `data === null`; `LoadError` with retry on failure, empty state only on success with zero watched
- [x] 6.2 `MovieDetailPage`: `Promise.allSettled`, details essential (404 → not found, other → `LoadError` with in-place retry via `reloadKey`), secondary failures fall back to empty data
- [x] 6.3 Same for `TVDetailPage`
- [x] 6.4 `PersonPage`: cancellation flag, reset `person`/credits on `id` change, 404 → not found, other failure → `LoadError` with retry; merge duplicate cast credits by id joining roles with " / "
- [x] 6.5 `EpisodeGuide`: `setLoading(false)` on cache-hit branch; catch season failure → `LoadError` with retry for that season
- [x] 6.6 `useEpisodeProgress`: cancellation flag, `setProgress(null)` on `showId` change / logout

## 7. Writes

- [x] 7.1 `RatingModal`: await `onSave`, close only on success, `confirmLoading` while saving; optional `onRemove` → "Remove rating" button when `existing` is set
- [x] 7.2 Wire `onRemove` (`removeRating`) in MovieDetails, TVShowDetails and WatchlistPage; make callers rethrow on save failure (after their error toast) so the modal stays open, and stop closing the modal themselves
- [x] 7.3 `TVShowDetails` episode progress: try/catch with error toast for Next Episode (:257), clear (:275), Save (:301, editor stays open on failure)

## 8. Shared follow and notification state

- [x] 8.1 Create `FollowedPeopleProvider` from the `useFollowedPeople` body (mounted beside `ListsProvider` in `index.tsx`); turn `useFollowedPeople` into a context reader; add per-person inflight guard
- [x] 8.2 `PersonPage` (:184-192) and `PersonCard` (:71-80) follow/unfollow: try/catch with error toast; confirm FollowingPage list updates on unfollow from a card
- [x] 8.3 Create `NotificationsProvider` (inside the auth boundary) from `useNotifications`; `NotificationBell` reads context so Sidebar + BottomNav share one poller
- [x] 8.4 `NotificationBell`: snapshot unread ids on open and render bold from it; call `markSeen()` on close instead of open
- [x] 8.5 Update any unit tests/mocks that render PersonCard/NotificationBell without the new providers

## 9. Profile modal

- [x] 9.1 `ProfileModal`: clear `deletePassword` and `newPassword` when the modal closes, and clear `deletePassword` after a failed delete

## 10. Verification and docs

- [x] 10.1 `npx tsc --noEmit` and `npm test -- --watchAll=false` pass
- [x] 10.2 Playwright check under `npm run dev`: forced-failure library load (route abort) shows error + retry; Watchlist first frame shows skeleton not empty CTA; double-click watchlist toggle sends one POST; rating save failure keeps review; Home→detail→back restore still restores multi-page scroll; delete `verify_*` scripts afterwards
- [x] 10.3 Run the e2e suites (TS + Python) and fix any fixture fallout from the provider moves
- [x] 10.4 Update CLAUDE.md conventions (LoadError, inflight guard in hooks, toast key collapse, FollowedPeople/Notifications providers) and add rationale bullets to `docs/ARCHITECTURE.md`
- [x] 10.5 Flip `surface-failures` to ✅ in the `docs/BUG_BACKLOG.md` status table on archive
