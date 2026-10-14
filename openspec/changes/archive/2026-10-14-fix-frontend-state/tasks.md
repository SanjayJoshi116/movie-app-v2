## 1. Infinite scroll after a failed first page

- [x] 1.1 `usePaginatedFetch.loadMore`: return early while `error` is set
- [x] 1.2 `HomePage` and `AnimePage`: add `!error` to `useInfiniteScroll`'s `enabled`
- [x] 1.3 Jest (`usePaginatedFetch.test.tsx`): page 1 fails → `loadMore()` sends nothing; after a category change whose page 1 fails, no page N+1 of either category is requested; `retry()` succeeding re-enables paging

## 2. Inflight actions and exclusive runs

- [x] 2.1 `createInflight`: `run(key, fn, action?)` queues a different action behind the pending one (same action, or none, still dedupes); add `runExclusive(fn)` (waits for every pending key, and new runs wait for it), `whenIdle()`, and `group(id)` for a scoped inflight
- [x] 2.2 Jest (`inflight.test.ts`): same action dedupes; a different action runs after and resolves with its own outcome, also after a failure; `runExclusive` waits for pending runs and blocks new ones until done; groups are independent

## 3. Library hooks: action-aware writes, ordered clears, guarded reloads, derived loading

- [x] 3.1 Add `guardedReload(seqRef, fetch, apply)` in `src/utils/` (drop and rerun when a write finished since the start, at most twice, then apply), plus a `writeSeq` bump in each hook's write wrapper
- [x] 3.2 `useWatched` / `useWatchlist`: pass actions (`add`, `remove`, `toggle`) to `run`, `clearAll` via `runExclusive`, reload through `guardedReload`, `isLoading` derived from the session generation of the last finished load
- [x] 3.3 `useRatings`: add the inflight slot (`set` and `remove` per title with actions), `guardedReload`, derived `isLoading`
- [x] 3.4 `useLists`: item writes and `clearList`/`deleteList` through `group(listId)` (clear and delete exclusive within the list, with actions), `guardedReload` for `fetchLists`, derived `isLoading`
- [x] 3.5 Jest per hook: a reload started before an add that lands after it keeps the item and its row id, so remove sends a DELETE; unmark during a pending mark ends unmarked; Clear All during a pending add sends the clear after the add and ends empty; an add during a clear is sent after it; `isLoading` is true on the first render after a sign-in; double save rating sends one request

## 4. Session-scoped browse state and return path

- [x] 4.1 `UIProvider`: reset `searchTerm`, `includeAdult` and `selectedGenres` on a signed-in → signed-out transition (render-phase, previous-value pattern); `App.tsx`: same for `activeFilters`/`activeSortBy`
- [x] 4.2 `AuthProvider`: `signedOutInThisTab` (true after an in-app sign-out, including the storage listener's; false on sign-in), exposed from `useAuth()`; `App.tsx`'s guard passes `from` only when it's false
- [x] 4.3 Jest: after logout, `includeAdult`/genres/search term are defaults and App's applied filters are cleared; after logout or another tab's sign-out the guard redirects without `from`; on a fresh signed-out load it keeps `from`; forced logout still lands back on its page (existing tests stay green)

## 5. Follow controls, mark-seen, refresh queue, downloads

- [x] 5.1 `PersonCard` and the person page: disable Follow while `loading || error`, with a "Loading follow status" tooltip while loading
- [x] 5.2 `useNotifications.markSeen`: bump `seenEpochRef` again in `finally`
- [x] 5.3 `userApi` interceptor: set `original._retry = true` before replaying a queued request
- [x] 5.4 `downloadBlob(blob, filename)` in `src/utils/export.ts` (attached anchor, click, remove, revoke in a `setTimeout`); use it in `downloadCSV`, `downloadJSON`, `downloadAllAsZip`, the list CSV template and Calendar's `.ics`
- [x] 5.5 Jest: cards render disabled (and not "Follow") while follow state loads; a poll started during the mark-seen POST is ignored and the next one applies; a queued replay that gets 401 rejects without a second refresh call; `downloadBlob` revokes only after a tick and removes its anchor

## 6. Docs and verification

- [x] 6.1 CLAUDE.md: `createInflight` actions/`runExclusive`/`group` and `guardedReload` as the library-write rule (replacing the "don't put two operations on one key" note), session-scoped UI state resets on sign-out, `downloadBlob` for every download, and `signedOutInThisTab` with the return-path rule
- [x] 6.2 CHANGELOG `[Unreleased]`; `docs/BUG_BACKLOG.md` item 33 → 📝 now, ✅ on archive
- [x] 6.3 Run `npm run typecheck`, `npm run lint`, the full Jest suite, and only the e2e specs the change touches (browse/Home paging, write-feedback, library pages, people/follow, notifications, export/import, auth/session)
