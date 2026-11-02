## Context

Everything here is in `src/hooks` and `src/utils`, plus the callers that have to change with them. Relevant pieces as they stand:

- `useLibraryFilters` filters by type only when `getType` is passed ("omit for items with no movie/tv distinction"). Watchlist, Watched and ListDetail render the type select through `FilterBar` but don't pass `getType`.
- `csvParse.ts` has the per-column helpers. `normalizeWatchedAt` checks the ISO shape with a regex and the range with `Date.parse`; V8 rolls `2024-02-30` to 1 March. `parsePositiveInt` is `parseInt` with no upper bound. `backup.ts` has its own `positiveInt` copy and reads `followed.csv` columns inline.
- `guardedReload(writeSeq, fetch, apply)` reruns a load when a write settled during it. The callers (`useWatched`, `useWatchlist`, `useRatings`, `useLists.fetchLists`, `FollowedPeopleContext`) each keep a `reloading`/`loaded` flag that the first reload to finish clears. Nothing orders two overlapping reloads.
- `usePaginatedFetch`'s restore branch runs `Promise.all` over every saved page, and `finally` sets `isRestoringRef.current = false` whether or not the restore succeeded, so `retry()` loads page 1.
- `filterByGenreOverlap` reads `item.genre_ids.filter` unguarded; callers pass `(genres ?? []).map(...)`.
- `inflight.run` returns the pending promise for a same-action repeat without looking at `exclusive`.

## Goals / Non-Goals

**Goals:**
- Fix the eight confirmed findings of item 57 and the no-trigger inflight case (cheap, same file), and do the two cleanups.
- Keep each fix inside the shared helper so all callers get it.

**Non-Goals:**
- Changing the server's validation or the bulk endpoints' all-or-nothing behavior.
- Bounding a backup's list manifest fields (`name`, `description`, `createdAt`): lists are created one request each, so a bad value fails only that list. Not in this item.
- Persisting a failed restore across a page reload.

## Decisions

1. **Type filter: the three pages pass `getType`.** Defaulting `getType` to `.type` would make Lists/Following (which have no movie/tv field) filter everything out once a stale `typeFilter` sat in sessionStorage, and would change the documented "omit → no-op" contract. Each page passes a module-level `getType = (i) => i.type` (stable identity, so the `useMemo` holds). The bug hid because only the hook was tested; add page-level tests. *Alternative:* make the hook return `typeFilter` only when `getType` is set, so a page without it can't render the select. Rejected for now: more churn, and `FilterBar` takes the config object regardless.

2. **Real-moment check on the written fields.** After the regex, before the range check, read `YYYY-MM-DD` and `HH:MM[:SS]` from the string and require month 1–12, day ≤ days in that month (leap rule), hour ≤ 23, minute and second ≤ 59, and an offset hour ≤ 23. A field check on the string is enough, since DRF also validates the written fields. The date-only form goes through the same check.

3. **One strict id parser.** `parseId(raw)` in `csvParse.ts`: `/^\d+$/` on the trimmed cell, value 1…`INT32_MAX` (2,147,483,647, restated from `serializers.py` like the other bounds), else `null`. Used for media ids in both CSV readers and for person id, show id, season and episode in `backup.ts`; `backup.ts`'s `positiveInt` goes.

4. **Backup follows through the shared helpers.** Export `parseTitle` (cut to 500 code points), `parsePosterPath` and `normalizeWatchedAt` and use them in `readFollowed`: `name: parseTitle(r.name)`, `profilePath: parsePosterPath(r.profile_path) ?? null`, `followedAt` only when `normalizeWatchedAt` keeps it. A blank name still restores as blank (the person label rule covers it).

5. **Newest reload wins: a reload sequence inside `guardedReload`.** Add an optional `reloadSeq: { current: number }` argument (each caller keeps one ref). On entry `const mine = ++reloadSeq.current`; before `apply`, drop the result when `reloadSeq.current !== mine`; `guardedReload` returns whether this call was the newest (`true`/`false`) and rethrows only for the newest. Callers clear `reloading` (and set `loadedGen`/`error`) only when their call was the newest. Keeping it inside `guardedReload` keeps the five callers alike. *Alternative:* coalesce (a reload requested during one sets a "rerun" flag and the running one loops). Rejected: the caller's promise would then settle with someone else's outcome, and `FollowedPeopleContext.retry()` vs `reload()` semantics differ.

6. **Restore: pool of 4, restore kept for Retry.** Fetch saved pages with a small local `mapLimit(pages, 4, fetchPage)` helper (in `usePaginatedFetch.ts`, or `src/utils` if a second caller appears), preserving page order. On failure, keep `isRestoringRef.current` true (set it false only after a successful restore or a non-restore load), so `retry()` runs the same restore; scroll restore still waits for items (`didRestoreScrollRef`). A fetch result that arrives after cancellation is still dropped by `ctl.cancelled`.

7. **Genre overlap guarded at the util.** `filterByGenreOverlap(items: unknown[], sourceGenreIds: unknown)`: items that aren't objects are dropped, `arrayOr(item.genre_ids)` gives `[]` for a missing list, and `arrayOr(source)` (ids filtered to numbers) gives no filter when missing. Callers pass `genres` through `arrayOr` before mapping ids. Return type stays `T[]`.

8. **Inflight: don't share across a later clear.** `run` records the exclusive generation (a counter bumped by each `runExclusive`) with each pending entry; a same-action repeat shares the pending promise only when no exclusive started after it (`entry.exclusiveGen === exclusiveGen`). Otherwise it queues behind the clear like a different action.

9. **Cleanups.** `todayLocalISO(now)` returns `localISODate(now)` (kept as the browse-side name, one implementation). `whenIdle` is removed from `Inflight` and its tests.

## Risks / Trade-offs

- [Pages pass `getType` by hand again: a fourth library page could forget it] → page tests for all three, and a comment on `Options.getType` saying a page that renders the type select must pass it.
- [Stricter id parsing skips rows that used to import (e.g. `550.0`)] → those were silently imported as a truncated id or would fail the chunk; the import summary already reports skipped rows.
- [A dropped older reload's error is lost] → only when a newer reload exists, whose own outcome is shown; intended by the spec.
- [Restore pool of 4 is slower than all-at-once for 40 pages] → bounded by the proxy throttle anyway; 4 keeps a 10-page restore to about 3 round trips.
