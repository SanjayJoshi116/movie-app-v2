## Context

See proposal.md for the bug list. The fixes span the Stats endpoint (`stats_views.py`), one dedupe in `social_views.py`, the Stats page, and the list-restore path. That path is the one structural piece: `bulk_import()` (`bulk_import.py`) assumes rows are scoped by `user=`, while `UserListItem` is scoped by `user_list`. Both list timestamps are `auto_now_add`, which overwrites any supplied value.

## Goals / Non-Goals

**Goals:**
- One rounding helper used by every Stats average and the buckets.
- List items join the existing bulk-import path. No second bulk mechanism.
- Backups stay additive: old backups (no list `createdAt`) still import, and new backups still open in older readers.

**Non-Goals:**
- Item 24's overlapping restore bugs: same-name list merge, the reload-failure message, follows and episode progress in backups, and poster throttling.
- Changing how Stats pages or caches its response.

## Decisions

**1. `round_half_up(x, places=1)` in `stats_views.py`.**
- It uses `Decimal(str(x)).quantize(Decimal("0.1"), ROUND_HALF_UP)`, returned as a float. Passing through `str` avoids binary artefacts (7.25 is exact, but a sum/len like 7.249999 must not drift).
- Buckets use `int(Decimal(str(r)).quantize(Decimal("1"), ROUND_HALF_UP))`, clamped to 1–10. Half-step ratings 0.5–10 then fill each bucket with exactly two values.
- Alternative considered: `math.floor(x + 0.5)`. Rejected, because float addition can misround a value just below .5.

**2. Monthly range: first watch month through the device's current month.**
- The range is built from `entry_local()` months and `local_today(request)`. If a stored future-dated watch (clock skew) lands past "today", the range extends to it, so nothing is dropped.
- The label format is unchanged (`%b %Y`).
- Alternative considered: stopping at the last watch month. Rejected, because recent inactivity is real activity data.

**3. Average TMDB rating over `vote_average > 0`.**
- It is `None` when nothing qualifies. The frontend already handles `null` (`avgTmdbRating` is `number | null`). A task re-checks this.

**4. Followed-people dedupe on `(id, media_type)`.**
- `seen` becomes a set of pairs, matching the `watched_set` check right above it.

**5. A scoped `bulk_import`.**
- A new `scope` kwarg holds the filter that identifies "this owner's rows", defaulting to `{"user": request.user}`. The list view passes `{"user_list": user_list}` and a `build` that sets `user_list`.
- The rest is unchanged: validation, dedupe on the validated pair, the existing-pairs pre-check, all-or-nothing, and `bulk_create(ignore_conflicts=True)`.
- The entry serializer is `BulkWatchlistEntrySerializer`, whose fields (media identity, title, poster, vote, `addedAt`) are exactly a list item's.
- New route: `lists/<int:list_pk>/items/bulk/`, taking `get_object_or_404(UserList, pk=list_pk, user=request.user)` (404 for someone else's list). It sits before the `items/<int:item_pk>/` route.

**6. Model defaults.**
- `UserList.created_at` and `UserListItem.added_at` become `default=timezone.now`, as was done for the watched/watchlist timestamps.
- The migration is generated with the pinned Django 5.2 interpreter (`G:/Anaconda/envs/django/python.exe`). Single-item serializers keep `addedAt` read-only.
- `UserListSerializer.createdAt` becomes writable on create only, through a `_past_timestamp()` field. Updates ignore it: `update()` pops it, so renaming a list can't move it in the order.

**7. Backup manifest `createdAt`.**
- `BackupManifest.lists[]` gains an optional `createdAt`. The reader passes it through when it is a string, and leaves it absent otherwise.
- The restore calls `createList(name, description, createdAt?)`. `useLists.createList` gains the optional third argument, and `userApi`'s list create sends it only when present.

**8. Restore and CSV import through a `bulkAddListItems(listId, entries)` helper in `userApi.ts`.**
- It chunks at 500 and sums `{added, skipped}`, as `bulkImport()` does, and a rejected chunk counts as failed.
- Backup entries send `addedAt` from the CSV's `added_at`.
- For rows without a date (hand-made CSVs), the client sends them in **reverse file order**, so `-added_at, -id` displays them in file order. Entries sharing the import instant tie on time and fall back to `-id`. Rows with dates are unaffected by the reversal, since their order comes from the dates.

**9. Stats page.**
- **Tooltip names:** `CustomTooltip` keeps mapping `count` → "items". The genre bar gets `name="Avg rating"`, and the tooltip prints `p.name` for anything else.
- **Heatmap date:** `formatDateDMY(day.date)`.
- **Info text:** "Counts the titles you marked watched each day."
- **Top Genres empty text:** branches on `totalWatched`. With watches it says "Genres are still being looked up for your watched titles. Check back in a minute."; with none it says nothing has been watched yet.
- **Heatmap keyboard:** the grid container is the single tab stop (`tabIndex={0}`, `role="group"`, `aria-label`), with an `activeIndex` state over the flattened non-future days. Arrows follow the grid (columns are weeks, rows are weekdays): Up/Down move ±1 day and Left/Right ±7, clamped to shown days. Focusing the heatmap starts on today. The active cell gets a visible outline, the same hover bubble is positioned from the cell's rect, and an `aria-live="polite"` visually-hidden span carries "05-03-2026: 2 items".
- Rejected: a tab stop per cell (365 stops) and a separate data table (duplicate content).

## Risks / Trade-offs

- [Risk] Making `UserList.created_at` writable lets a client backdate a list. → Impact is the user's own sort order only, and the value is validated past-only and after 1900.
- [Risk] Reversing undated rows is a client-side convention. → It's pinned by an e2e or unit test on the helper, and a dated backup doesn't depend on it.
- [Risk] A long first-watch history gives many monthly points (20 years is 240). → Recharts handles that. The axis may thin its ticks, which is acceptable.
- [Risk] Moving off `auto_now_add` means any other `UserListItem` creation path without a value now relies on the default. → The default is `timezone.now`, the same value.

## Migration Plan

- One additive schema migration (defaults only, no data change), applied by the normal `start.py`/entrypoint migrate step.
- The new route and the manifest field are additive.
- Rollback: revert the code. The migration is harmless to leave in place, and it reverses cleanly if needed.
