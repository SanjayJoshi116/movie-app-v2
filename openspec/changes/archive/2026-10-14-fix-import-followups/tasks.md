## 1. Session guard for imports

- [x] 1.1 Add `SessionEndedError` and `sessionGuard()` to `src/api/userApi.ts`; `postBulkChunks` (and the four bulk helpers) take an optional `{ guard }` and call `guard.check()` before each chunk, letting `SessionEndedError` propagate instead of counting the chunk as failed
- [x] 1.2 `pacedLookup` takes an optional `shouldStop()` and hands out no new items once it is true; `lookupImportPosters` passes it through
- [x] 1.3 `CSVImportAllModal`: create the guard at submit, pass it to every write and to the lookups, `check()` before each `createList` and before the reloads, re-throw `SessionEndedError` from the per-section `run()`, and drop the run (no toast, results, reload or state update) when it ends the session
- [x] 1.4 Same for `CSVUploadModal` and `CSVListImportModal`
- [x] 1.5 Jest: `postBulkChunks` stops before the next chunk after the generation changes and throws `SessionEndedError`; `pacedLookup` stops handing out items once `shouldStop()` is true; for each modal, a sign-out during lookups sends no bulk/list/follow write and shows no toast (extend `CSVUploadModal.test.ts`; add tests for the other two)

## 2. Import dialogs can't close while running

- [x] 2.1 All three modals: `onCancel`, `maskClosable`, `keyboard` and `closable` disabled while `loading`, following `RatingModal`
- [x] 2.2 Jest: Escape and the close button do nothing while an import runs, and work again once results show

## 3. Episode progress writes

- [x] 3.1 Replace `createInflight` in `useEpisodeProgress` with a per-show slot: same op and arguments → the pending promise; a different op (or arguments) → queued after the pending one settles, resolving with its own outcome; `busy` stays true until the queue drains
- [x] 3.2 Capture `currentSessionGeneration()` before each write and skip `setProgress`/`setBusy` unless `isCurrentSession(gen)`
- [x] 3.3 Jest (`useEpisodeProgress.test.ts`): Next then Remove before Next resolves → the DELETE is sent after the POST settles, `clear()` resolves only after the DELETE, and progress ends null; double Next → one POST; a write that resolves after sign-out doesn't set progress

## 4. Shared lookup schedule on 429

- [x] 4.1 `lookupOne`: on a 429 push the module-level `nextSlotAt` to `max(nextSlotAt, now + retryAfter)` and retry through `takeSlot()` instead of sleeping the one worker
- [x] 4.2 Jest (`pacedLookup.test.ts`, fake timers): with 4 workers, one 429 with `Retry-After: 5` → no lookup call of any worker for 5 s, then all items resolve

## 5. CSV watched-time parsing

- [x] 5.1 Add `normalizeWatchedAt()` in `csvParse.ts` (ISO date-time with offset or `Z` kept; date-only → `T12:00:00Z`; anything else undefined; same 1900 → now bounds) and use it in `parseCSVForImport`
- [x] 5.2 Jest (`csvParse.test.ts`): `05/01/2024`, `May 1, 2024` and an offset-less `2024-05-01T10:00` are dropped for that row; `2024-05-01` becomes `2024-05-01T12:00:00Z`; a DRF-style value with microseconds and `Z` (as the Watched export writes) is kept unchanged

## 6. Notifications and followed people

- [x] 6.1 `useNotifications`: a request-id ref so only the latest refresh's response (or error) applies; the follow-change effect schedules the refresh on a 1.5 s trailing debounce, cleared on unmount and sign-out
- [x] 6.2 `FollowedPeopleContext`: add `reload()` (`retry()` plus a `changes` bump); `CSVImportAllModal` reads it with `useContext(FollowedPeopleContext)?.reload` instead of `useFollowedPeople()`, and the stale comment goes
- [x] 6.3 Add `personLabel(name, id)` in `src/utils/` and use it in `PersonCard` (title, alt, aria labels, toasts) and anywhere else `FollowingPage` shows a followed person's name; `notifications_views.py` sends `fp.name or f"Person {fp.person_id}"`
- [x] 6.4 Jest (`useNotifications.test.tsx`, fake timers): an earlier refresh that resolves last is ignored; five follow changes in 1 s → one request after the debounce; `reload()` bumps `changes`; rendering `CSVImportAllModal` makes no `/followed-people/` request; `personLabel` falls back for blank and whitespace names
- [x] 6.5 Backend test: a followed person with a blank name yields `personName` "Person <id>" in notifications

## 7. Filter drawer seeding

- [x] 7.1 `FilterPanel`: seed the draft with `genresFor(isMovie ? "movie" : "tv", selectedGenres)` when it opens
- [x] 7.2 Jest: opening the panel for TV with a movie-only genre in `selectedGenres` shows no genre picked

## 8. Docs and verification

- [x] 8.1 CLAUDE.md: in the session-teardown bullet, a long-running import takes a `sessionGuard()` and passes it to every write (the bulk helpers check it per chunk); in the Load and write feedback bullet, an import dialog can't close while running; in the notifications bullet, follow changes refresh on a debounce, and a restore calls `reload()`, not `retry()`
- [x] 8.2 CHANGELOG `[Unreleased]` entries; `docs/BUG_BACKLOG.md` item 31 → 📝 now, ✅ on archive
- [x] 8.3 Run `npm run typecheck`, `npm run lint`, the Jest suite (`CI=true npx react-scripts test --watchAll=false`), the backend notifications tests plus `ruff check backend/`, and only the e2e specs the change touches (`e2e/import.spec.ts`, `e2e/notifications.spec.ts`, plus any spec covering episode progress or the filter panel)
