## Context

See proposal.md for the why. The constraints that shape the approach:

- `currentSessionGeneration()` / `isCurrentSession(gen)` (`src/api/userApi.ts`) are the existing guard against a previous session's responses. The library hooks, `useNotifications` and follow writes use them. The imports don't, and the `userApi` interceptor doesn't stop them either: once B signs in *in the same tab*, the tab is bound to B, so A's import requests go out with B's token.
- A restore is many writes over minutes: paced poster lookups (90/min, about 5.5 min for 500 rows), then `postBulkChunks` (500 per request) per section, then `createList` + `bulkAddListItems` per list, then follows and episode progress.
- `createInflight()` dedupes by key and returns the pending promise to *any* caller with that key. `useEpisodeProgress` puts `update` and `clear` on one key, so a Remove during a Next settles with Next's promise.
- `pacedLookup.ts` has one module-level `nextSlotAt` shared by every import in the tab. A 429 only `sleep`s the worker that got it.
- `parseCSVForImport` accepts anything `Date.parse` reads. DRF's `DateTimeField` accepts ISO 8601 only, and a bulk request is all-or-nothing, so one `05/01/2024` row fails its 500-row chunk.
- `useNotifications.refresh` has a session check and a mark-seen epoch, but no ordering between two refreshes. Every follow-change bump calls it straight away.
- `FollowedPeopleContext.retry()` reloads the list but doesn't bump `changes`, which is what `useNotifications` watches.

## Goals / Non-Goals

**Goals:**
- One mechanism stops an import at its next write after sign-out. It covers every write the import makes, including the chunked bulk helper, without each call site re-checking by hand.
- Fix the in-flight semantics in `useEpisodeProgress` without changing `createInflight` for its other users.

**Non-Goals:**
- Cancelling an import from the UI (a Stop button). The dialog just can't be closed while it runs.
- Cancelling HTTP requests already sent. A write in flight at sign-out completes on the server for A, the account that sent it, and that's correct. Only *later* writes and the UI updates are stopped.
- Validating timestamps in backup ZIPs (`parseBackupCSV`). Those come from the app's own exporter. Hand-edited backups are out of scope here.

## Decisions

### 1. Imports carry a session guard into every write
A small helper in `userApi.ts`:

```ts
export class SessionEndedError extends Error {}
export function sessionGuard() {
  const gen = currentSessionGeneration();
  return { gen, check() { if (!isCurrentSession(gen)) throw new SessionEndedError(); } };
}
```

- `postBulkChunks` (and so `bulkImport`, `bulkAddListItems`, `bulkImportFollowed`, `bulkImportEpisodeProgress`) takes an optional `{ guard }` and calls `guard.check()` before each chunk. A `SessionEndedError` propagates. It is *not* counted as a failed chunk.
- `pacedLookup` takes an optional `shouldStop()` and stops handing out items once it returns true, so lookups don't keep spending the next account's proxy quota. `lookupImportPosters` passes it through.
- Each modal creates the guard at submit, passes it to every write, and calls `guard.check()` before `createList` and before the reloads. One `catch (err) { if (err instanceof SessionEndedError) return; … }` at the top of `handleSubmit` drops the whole run: no toast, no results, no reload, and no `set*` (the modal is gone after teardown anyway). The `finally` that clears `loading` also checks the session, following the hooks' rule.
- `CSVImportAllModal`'s per-section `run()` re-throws `SessionEndedError` instead of recording the section as failed, so later sections don't run.

*Alternative:* check `isCurrentSession` inline before every call. There are about 12 write sites across three modals, plus the chunk loop, and one missed check is the bug. Putting it in the chunk helper covers the bulk writes in one place.

### 2. Import dialogs can't close while busy
All three modals use the `RatingModal` pattern: `onCancel={loading ? undefined : handleClose}`, `maskClosable={!loading}`, `keyboard={!loading}`, `closable={!loading}`. The progress (`ImportProgress`) and the button's `loading` already show that it's running. The Done button only exists after results, so it needs no change.

### 3. Episode progress: same action dedupes, a different action queues behind
`useEpisodeProgress` keeps its own per-show slot, `{ op: "update" | "clear", key, promise }`, instead of `createInflight`:
- Same op and same arguments while pending → return the pending promise (the double-click case).
- Otherwise → `pending.promise.catch(() => {}).then(run)`, so the new write runs after the first settles and resolves with its own outcome.

`busy` stays true from the first write until the queue drains. `createInflight` keeps its current contract for every other hook, because nowhere else do two different operations share a key. Each write also captures `currentSessionGeneration()` before its request and skips `setProgress`/`setBusy` unless `isCurrentSession(gen)`, as the other library hooks do.

*Alternative:* separate keys per operation. Then Next and Remove run in parallel, and the server's final state depends on which request lands last.

### 4. A 429 pushes the shared schedule
In `lookupOne`, on a 429: `nextSlotAt = Math.max(nextSlotAt, Date.now() + retryAfterMs(err))`, then `continue`. The worker no longer sleeps on its own, because `takeSlot()` now waits for everyone. Tries per item stay `MAX_RATE_LIMITED_TRIES`. This also covers two imports running in one tab, since the schedule is module-level.

### 5. CSV watched times: ISO with offset, or date-only as noon UTC
A `normalizeWatchedAt(raw): string | undefined` in `csvParse.ts`:
- `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$` → kept as given, if it parses and is within the existing 1900 → now bounds.
- `^\d{4}-\d{2}-\d{2}$` → `${date}T12:00:00Z`, under the same bounds. Noon UTC falls on the same calendar day from UTC−12 to UTC+11, and a blank `watched_tz` already falls back to the viewing device's zone (`user-local-dates`). Midnight UTC showed as the day before in every western zone.
- Anything else → undefined, so the row gets the import time (the existing behavior for unreadable values).

The Watched page's own export writes the API's `watchedAt` as is (DRF's ISO 8601 with `Z` and up to 6 fractional digits), which the pattern accepts, so the round trip is unchanged.

### 6. Notifications: request ids for ordering, a debounce for follow bursts
- A `requestIdRef` increments at the start of each `refresh`. A response applies only if its id is still the latest (in addition to the session and seen-epoch checks). This covers poll vs follow-refresh too.
- The follow-change effect schedules the refresh with a 1.5 s trailing debounce (timer cleared on unmount and sign-out) instead of calling it immediately. Ten follows in a few seconds become one request.
- `FollowedPeopleContext` gets `reload()`: `retry()` plus `setChanges(c => c + 1)`. The import calls `reload()`, so restored follows count as a follow change. `retry()` keeps its meaning (re-run a failed load), so a Retry click doesn't refresh notifications.

### 7. The import dialog reads the context without the lazy fetch
`CSVImportAllModal` uses `useContext(FollowedPeopleContext)?.reload` (as `useNotifications` does) instead of `useFollowedPeople()`, which calls `request()` on mount. Opening Profile no longer fetches `/followed-people/`. The stale comment near the reload goes.

### 8. Blank names: one display helper, plus the server's notification item
`personLabel(name, id)` in `src/utils/` returns `name.trim() || \`Person ${id}\``. `PersonCard` uses it for the title, alt text, aria labels and toasts, and `FollowingPage` uses it wherever it shows the name. Notification items carry no person id, so `notifications_views.py` sends `fp.name or f"Person {fp.person_id}"`. Stored data is unchanged.

### 9. Filter drawer seeds through `genresFor`
`FilterPanel`'s open effect seeds `setDraftGenres(genresFor(isMovie ? "movie" : "tv", selectedGenres))`. `App`'s render-time reset stays the source of truth. This only stops a remount from taking a draft from the previous scope.

## Risks / Trade-offs

- [A write already sent when the session ends still completes, for the account that sent it] → Intended: it carries A's token and lands in A's account. Only later writes are stopped.
- [The 1.5 s debounce delays the bell after a single follow] → It is still far sooner than the 3-minute poll, and the spec says "shortly after".
- [A blocked dialog during a 5-minute restore feels heavy] → The progress line is visible the whole time. A Stop button is a possible follow-up, not needed for correctness.
- [Date-only rows at noon UTC show the day before in UTC+12…+14] → Rare zones. A blank zone is the existing convention, and the alternative (per-row zone math) isn't worth it for this input.
- [`busy` covers a queued write too] → Next and Save stay disabled until the queue drains, which matches what the user sees.
