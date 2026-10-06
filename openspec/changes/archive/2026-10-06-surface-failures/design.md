## Context

See proposal.md for why. Current state that shapes the approach:

- **Library hooks:** `useWatched`, `useWatchlist`, `useRatings` and `useLists` each own a collection. Each is memoized into a context (`WatchedContext`, `WatchlistContext`, `RatingsContext`, `ListsProvider`), and `useAppContext()` re-exports them as `AppContextType`. Today:
  - `isLoading` starts `false`.
  - Load failures become unhandled rejections.
  - No hook exposes an `error`.
  - Context types declare mutations as `void`, so a missing `await` compiles cleanly.
- **`usePaginatedFetch`:**
  - Already has a `cancelled` flag on its page-1 effect, plus a StrictMode replay guard (CLAUDE.md) that must survive this change.
  - `loadMore` has no staleness check.
  - Failures only `console.error`.
- **Write call sites:** most already use `try { await x(); showSuccess() } catch (err) { showError(getApiError(err, ...)) }` with `useToast` and `getApiError`. The bugs are the call sites that don't. Nothing guards against in-flight duplicates.
- **`useFollowedPeople` and `useNotifications`:** these are plain hooks instantiated per component. `PersonCard` makes N instances. The bell is mounted in both `Sidebar` and `BottomNav` (CSS hides one), so it makes 2 instances.
- **Notifications "seen":** stored server-side (`NotificationCheckpoint.last_seen_at`). `isUnread` comes from the backend.

## Goals / Non-Goals

**Goals:**
- One reusable pattern for each concern (load state, error UI, in-flight dedupe, stale-response discard), applied consistently. No per-page one-offs.
- Keep the existing public hook names and call shapes, so the diff stays mechanical at call sites.

**Non-Goals:**
- Optimistic updates. Writes still update local state only after the server confirms.
- Adding a data-fetching library (React Query/SWR). That would be the "proper" fix for most of this, but it's a rewrite of every hook, far beyond a bug-fix change.
- Lint enforcement of floating promises (`@typescript-eslint/no-floating-promises`). It needs type-aware ESLint config, which CRA's built-in config doesn't support without ejecting or adding overrides. Call sites are fixed by audit, and types are corrected so `await` is at least meaningful.
- Browse filter/restore UX bugs (`fix-browse-filters`, #4), apart from the `usePaginatedFetch` staleness and error handling listed here.

## Decisions

### 1. Library hooks: `isLoading` initial = `isAuthenticated`, plus an `error` field and a retryable `reload`
Each library hook gets `error: unknown | null` and initializes `isLoading` to `isAuthenticated`. On the first frame the collection then reads as "loading", not "empty". It goes false at once when logged out.
- The initial-load effect and `reload()` share one loader that sets `error` on failure and clears it on success.
- If a reload fails after a previous successful load, the existing items are kept. The page sees `error` together with non-empty items and shows a toast instead of the full error state.
- The contexts already spread the hook's return value, so `error`/`reload` flow through. `useAppContext` adds `watchlistError`/`watchedError`/`ratingsError` plus the matching reloads. `ListsContextType` adds `error` and `reload`.
- *Alternative considered:* a single `status: "idle" | "loading" | "error" | "ready"` enum. It's cleaner, but it changes every `isLoading` consumer, including `isDataLoading`. The two-field form is additive.

### 2. Shared `<LoadError>` component
Add `src/components/LoadError.tsx`: an antd `Result` with `status="error"` or `"404"`, a title, and an optional `onRetry` that renders a Retry button. Detail pages, person page, stats, library pages, paginated grids and the episode guide all use it. The existing `window.location.reload()` buttons on detail pages are replaced with in-place refetch. Not-found states use the same component with `notFound`.

Library pages branch in this order: `isLoading && items.length === 0` → existing `SkeletonCard` grid; `error && items.length === 0` → `<LoadError onRetry={reload} />`; `items.length === 0` → empty-state CTA; otherwise content.

### 3. In-flight dedupe lives in the hooks, keyed per item
A small util, `src/utils/inflight.ts`, provides `createInflight()`. It returns `run(key, fn)`: if `key` already has a pending promise it returns that promise, otherwise it stores `fn()` and deletes it when settled. Each mutation hook holds one instance in a ref:
- `useWatched`/`useWatchlist`: key `${type}-${id}` for add, remove and toggle together. A remove while an add is in flight returns the add's promise instead of racing it.
- `useFollowedPeople`: key `person-${id}`.
- `useLists`: key `${listId}-${type}-${id}` for add/remove item; `list-${listId}` for delete/clear.

The repeat caller awaits the same promise, so it gets the same outcome: success → toast, failure → error. That's how the spec's "settles with the outcome of the in-flight write" is met.

*Why in the hook and not by disabling buttons:* there are ~25 toggle call sites (Movie, TVShowCard, detail pages, Search, Recommendations, Watchlist…). One guard in the hook covers all of them, plus future ones. Buttons may still show `loading` where a call site already tracks it, but correctness doesn't depend on that.

### 4. Identical toasts collapse
`useToast` passes `key: msg` to antd `message`. A second identical message then replaces the first instead of stacking. This takes care of the duplicate toast from deduped double-clicks without each call site tracking whether it was the "first" click. The call signature doesn't change.

### 5. Stale-response discard uses a generation counter
- **`usePaginatedFetch`:** a `generationRef` increments whenever `fetchPage` changes, which marks a new query or category. Page-1 and `loadMore` both capture the generation and drop the result if it has changed. `loadMore` also returns early while page 1 is loading.
- **Clearing items on change:** happens in the same effect that starts the page-1 fetch, *after* the existing StrictMode replay guard. A replay therefore still no-ops and doesn't clear a restored state. The `restoredState` seed path never clears.
- **New return values:** `error` (page-1 failure only) and `retry()`. A `loadMore` failure keeps the existing items and shows an error toast from inside the hook (`useToast` is memoized so `loadMore` keeps a stable identity for `useInfiniteScroll`), which matches the "background refresh" scenario.
- **PersonPage, EpisodeGuide, useEpisodeProgress:** these use the existing local idiom instead: `let cancelled = false` in the effect, with cleanup setting it, plus a reset of the entity state when the id changes. EpisodeGuide keeps its `requestedSeason` ref and also calls `setLoading(false)` in the cache-hit branch.

### 6. Detail pages: `Promise.allSettled`, with only the details call essential
`MovieDetailPage`/`TVDetailPage` switch to `Promise.allSettled`.
- If the main details call is rejected → error state, or not-found when `err.response?.status === 404`.
- If a secondary call is rejected → that piece of data falls back to its empty value (`{ results: [] }`-style), which the shared sections already render as empty or hidden.
- Retry bumps a `reloadKey` state that is in the effect's deps.

*Note:* the tmdb axios client retries a 5xx once after 2s, so a failing optional call can still delay first paint by about 2s. That's accepted here: making the retry policy per-call is out of scope.

### 7. Person credits deduped in PersonPage, not in MediaCardGrid
PersonPage merges cast entries by `id`, joining their `character` values with " / ", before passing them to `MediaCardGrid`. This fixes both the duplicate React key and the duplicate visible card. `MediaCardGrid` keeps `key={item.id}`. Its other callers (recommendations/similar/credits) don't produce repeats, and a defensive index key would hide real duplication bugs.

### 8. Rating modal awaits `onSave`; remove goes through an `onRemove` prop
`RatingModal` gets a `saving` state:
- `handleOk` awaits `onSave` and calls `onClose()` only on success.
- On failure it stays open with its local state intact. The caller already shows the error toast.
- The modal sets `confirmLoading`.

A new optional `onRemove?: () => Promise<void>` prop renders a danger "Remove rating" button in the footer when `existing` is set. The three callers pass `removeRating`. Callers stop closing the modal themselves on the save path.

### 9. FollowedPeople and Notifications become providers
- **`FollowedPeopleProvider`:** the current `useFollowedPeople` body moves into it, mounted next to `ListsProvider` in `index.tsx`. `useFollowedPeople()` becomes a thin `useContext` reader, so all five call sites stay as they are. The fetch is **lazy**: it starts when the first `useFollowedPeople()` consumer mounts, not on every authenticated page. An eager version put an unmocked `/api/followed-people/` call on every authenticated e2e page, which intermittently hung the Python suite through the 401→login redirect, and it would also add a request to every page load for no benefit. `FollowingPage` reads the list from the same context, so an unfollow from a card removes that person from the list.
- **`NotificationsProvider`:** wraps the same `useNotifications` body, mounted inside the auth boundary so polling still only runs when `isAuthenticated`. `NotificationBell` reads from context. Two bells then share one poller.

### 10. Mark notifications seen on close, using a snapshot taken on open
When the dropdown opens, `NotificationBell` saves the set of unread item ids in local state and renders bold from that snapshot. On close it calls `markSeen()` and clears the snapshot. `markSeen` still zeroes `unreadCount` locally, but that now happens after the user has seen the bold items.
- *Alternative considered:* keep marking on open and only delay the local `isUnread` reset. Rejected: if the tab is closed with the dropdown open, the items still end up seen, so the server state and what the user saw disagree.
- *Accepted cost:* closing the tab with the dropdown open now leaves them unread. That's the safer error direction.

### 11. ProfileModal clears passwords on close
Reset `deletePassword` and `newPassword` in the modal's close handler (`afterOpenChange(false)`) and in the delete-account `catch`. The component stays mounted, which is why the values survive today. Unmounting it would also reset the other profile fields, so it isn't unmounted.

### 12. Context mutation types return `Promise<void>`
Fix `types/context.ts` for `AppContextType` (watchlist/watched/rating mutations) and `ListsContextType` (`deleteList`, `addToList`, `removeFromList`). Then audit every call site from the verification list (WatchlistPage :116/:301, WatchedPage :201, ListDetailPage :133/:145/:218, TVShowDetails episode progress, PersonPage/PersonCard follow) and wrap each in the standard try/await/toast pattern.

## Risks / Trade-offs

- **[Risk] Clearing paginated items on `fetchPage` change interacts with the StrictMode replay guard and with restore.** → Clear only on the code path that actually starts a new page-1 fetch (after the guard), never on the `restoredState` seed path. Verify under `npm run dev`, using the Playwright restore flow documented in CLAUDE.md (navigate away and back on Home/Search).
- **[Risk] `isLoading` starting `true` changes `isDataLoading` on the first frame for every page that reads it.** → Intended. Check that no page blocks its whole render on `isDataLoading` in a way that now flashes a spinner where it didn't before (grep `isDataLoading` consumers during implementation).
- **[Risk] Deduping returns the in-flight promise even when the second click meant the opposite operation** (e.g. add then immediately remove). → For a double-click this is the intended reading. A deliberate second action after the first settles works normally. A user who wants to undo has to wait about a request's latency.
- **[Risk] Moving NotificationBell's state into a provider changes when the hook mounts.** → The endpoint is the same, so e2e fixtures (`mock_base_django_routes`, TS `beforeEach`) need no new mocks. Run the e2e suite once anyway, since CLAUDE.md flags global-poller changes as a source of mass login-redirect failures.
- **[Trade-off] Toast key = message text** collapses two *different* actions that happen to produce the same message within the toast's lifetime (e.g. marking two different titles watched quickly shows one "Marked as watched"). → Acceptable. Distinct titles are visible in the UI, and the message is generic anyway.

## Migration Plan

Frontend only, no backend or data changes. Ships in one release. Roll back by reverting the frontend.
