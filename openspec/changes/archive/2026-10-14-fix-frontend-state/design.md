## Context

See proposal.md for the why. The constraints that shape the approach:

- `usePaginatedFetch.loadMore` guards on `loading`, `loadingMore`, `hasMore` and `loadMoreError`, not on `error`. Home and Anime keep the sentinel mounted under `LoadError`, and `useInfiniteScroll` rebuilds its IntersectionObserver whenever `loadMore`'s identity changes. A visible sentinel therefore fires once per successful page.
- The library hooks (`useWatched`, `useWatchlist`, `useRatings`, `useLists`) each keep a list plus a `dbIdMap` (title → row id). `reload` replaces both wholesale. Writes patch them. Nothing orders a reload's result against writes that finished while it was in flight.
- `createInflight()` dedupes per key, and any caller with that key gets the pending promise. The library hooks put add, remove and toggle on one per-title key. `useRatings` has no slot at all. Clears use no slot (`useWatched`/`useWatchlist`) or the list's own `list-${id}` slot, which item writes (`${listId}-${type}-${id}`) don't share.
- `isLoading` starts as `useState(isAuthenticated)` and is set to true inside `reload`, which runs from an effect. On a sign-in transition there is one committed render with `isAuthenticated && !isLoading && list.length === 0`.
- Browse settings live in `UIContext` (`searchTerm`, `includeAdult`, `selectedGenres`) and in `App.tsx` (`activeFilters`, `activeSortBy`). Nothing resets them on sign-out. `UIProvider` sits under `AuthProvider`. `useRecentSearches` already resets on a signed-in → signed-out transition.
- `App.tsx` always redirects a signed-out user with `state={{ from: location }}`. That's right for opening a protected link while signed out, and wrong after an in-tab sign-out. A forced logout doesn't go through it: it reloads with `history.replaceState({ usr: { from } })`.
- The refresh queue's replay (`failedQueue` → `userApi(original)`) doesn't set `original._retry`, so a second `401` on the replay enters the refresh path again.

## Goals / Non-Goals

**Goals:**
- One ordering rule for the library hooks, implemented once (in `createInflight` and a shared reload guard), not four times by hand.
- Session-scoped UI state resets from one place, at the same moment as the library hooks clear.

**Non-Goals:**
- Merging a stale reload with newer writes. It is discarded and run again. This is simpler, and a reload is cheap next to a wrong screen.
- Optimistic UI. Writes still update the screen only after the server confirms.
- Changing `useEpisodeProgress` (its own queue from item 31 stays) or the follow slot (follow and unfollow are already one action each per click).

## Decisions

### 1. `error` stops paging; the sentinel needs it too
`loadMore` adds `error` to its guard. Home and Anime pass `enabled = hasMore && !loading && !error && !loadMoreError`. People and Search already don't render the sentinel on error. They get the guard for free from the hook. `retry()` resets page 1 as today, and the guard lifts when that succeeds.

### 2. `createInflight` learns actions and barriers
`run(key, fn, action?)`:
- Same key, same `action` (or no action, as today) while pending → the pending promise (the double-click case).
- Same key, different `action` → queued after the pending one settles (`.catch(() => {}).then(fn)`), resolving with its own outcome. This is the rule `useEpisodeProgress` implements by hand. Library hooks pass `"add"`, `"remove"`, `"toggle"`, `"rate"`, `"unrate"` and so on.

`runExclusive(fn)` is the clear: it waits for every pending key, runs `fn`, and while it runs every new `run()` waits for it first. The watched and watchlist Clear All use it, and so does a list clear (with list-scoped keys, see below). Ratings has no clear. `whenIdle()` is a small helper for tests and for the reload guard.

*Alternative:* a separate clear lock in each hook. That's four copies of the same ordering logic, which is how the per-hook drift happened in the first place.

### 3. Lists: one inflight per list for its items
`useLists` keys item writes `${listId}:${type}-${id}` inside a per-list group: `inflight.group(listId)` returns an inflight scoped to that list, so `clearList(listId)` can be `group(listId).runExclusive(...)` without blocking other lists. Create, delete and update stay on their existing keys. Delete also uses the group's exclusive run, so an add can't land on a deleted list's state.

### 4. Reloads are discarded if a write finished after they started
Each hook keeps a `writeSeq` ref, bumped when a write's server call resolves (success or failure, inside the inflight wrapper). `reload` captures it at start. On landing, if it changed, the result is dropped and `reload` runs again (at most twice in a row, then the result is applied, so a busy user can't starve it forever). The first load and `retry()` go through the same path. A small `guardedReload(seqRef, fetch, apply)` helper in `src/utils/` holds this logic for all four hooks.

### 5. `isLoading` is derived, not set from an effect
Each hook keeps `loadedGen` (the session generation of its last *finished* load, success or failure) and derives `isLoading = isAuthenticated && (loadedGen !== currentSessionGeneration() || reloading)`. On the first render after sign-in, the generation is new and nothing has loaded for it yet, so it reads as loading. `reloading` stays as state for the Retry spinner. This keeps the existing `isLoading` contract (true until the first load finishes) and closes the one-render gap.

### 6. Session-scoped UI state resets on sign-out
`UIProvider` watches `useAuth().isAuthenticated` and resets `searchTerm`, `includeAdult` and `selectedGenres` on a true → false transition, in the same render-phase pattern `App.tsx` uses for its scope reset (state compared against a stored previous value, set during render). `App.tsx` does the same for `activeFilters`/`activeSortBy`, using its existing `isAuthenticated`. Theme is a device preference, so it is kept.

### 7. Follow controls are disabled while follow state loads
`PersonCard` and the person page disable Follow when `loading || error` (today only `error`) and show a neutral "Loading follow status" tooltip. Lazy loading stays: a grid of cards still requests the list once.

### 8. Mark-seen bumps its epoch again when its request settles
`markSeen` bumps `seenEpochRef` before the POST (as today) and again in `finally`. A poll that started in between captured the first epoch, so its answer is dropped. The next poll after that applies as usual.

### 9. One download helper
`downloadBlob(blob, filename)` in `src/utils/export.ts`: append the anchor to the document, click, remove it, and `setTimeout(() => URL.revokeObjectURL(url), 0)`. `downloadCSV`, `downloadJSON`, `downloadAllAsZip`, the list CSV template and Calendar's `.ics` all use it. A small deferral is what browsers need, because the download reads the URL after `click()` returns.

### 10. Replays from the refresh queue are marked
In the queued branch, `original._retry = true` is set before `userApi(original)`, as in the branch that ran the refresh. A second `401` then fails that request, per the spec.

### 11. An in-tab sign-out drops the return path
`AuthProvider` keeps `endedInTab` state: set true on every in-app signed-in → signed-out transition (logout, delete account via logout, the storage listener's sign-out), and false on sign-in. `App.tsx`'s guard passes `state={{ from: location }}` only when `!endedInTab`. Opening a protected link while signed out (a fresh page load) and the forced-logout path (which reloads, so `endedInTab` starts false and the `from` comes from history state) both keep returning to the page. It's exposed from `useAuth()` as `signedOutInThisTab`.

## Risks / Trade-offs

- [Queueing a different action changes timing for any caller that relied on sharing] → The only sharing callers are the library toggles, where the repeated action is the same (`toggle`), so it still dedupes. Tests cover add during remove and toggle twice.
- [A discarded reload costs one more request] → Only when a write landed during the reload, which is rare, and capped at two retries.
- [`runExclusive` blocks every write in that collection while a clear is in flight] → A clear is one request and the user just asked to empty the collection. Item writes queue behind it rather than fail.
- [Resetting browse state on sign-out also resets it for the same user signing back in] → Intended. Sign-out ends the session's state.
- [Disabled Follow during the first load flickers on a cold People page] → One short request, shared by the grid, and the tooltip says why.

## Migration Plan

Frontend only. No data or API change, so deploy and rollback are just the frontend build.
