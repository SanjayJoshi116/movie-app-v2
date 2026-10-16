## Context

See proposal.md for the findings (backlog item 45). The relevant current code:

- `src/utils/csvParse.ts`:
  - `parseTitle` cuts with `slice(0, 500)`.
  - `parseBoundedText`, the review check and `parsePosterPath` compare `.length`, which counts UTF-16 code units. Django's `max_length` counts code points.
  - `normalizeWatchedAt` accepts times up to `Date.now()`. The server accepts up to its own now + `BULK_TIMESTAMP_SKEW` (5 min, `serializers.py`).
- `src/utils/importPosters.ts`:
  - `lookupImportPosters` looks up a row when `!posterPath || voteAverage === undefined`, and merges the poster with `||` and the score with `??`.
  - It never dedupes, and `missing` counts rows.
- `CSVImportAllModal.enrichPosterPaths` sends every backup row (watchlist + watched + list items) in one call and writes back only `posterPath`. `parseBackupCSV` reads a blank or bad score as 0 (item 44).
- `WatchlistPage.tsx`:
  - `filterReady = watchedFilter === "all" || watchedLoaded` (`hasLoaded`).
  - The error branch (`!filterReady && watchedError`) comes before the skeleton branch.
  - `useWatched.reload` keeps `error` until a success. `WatchedContext` already exposes `isLoading`, which is true while reloading.
- Detail pages:
  - Person renders LoadError for `error || !person`, while `detailPageTitle` sees no error.
  - Movie/TV spread whatever `data` is into the record, so an empty body (`""`) gives a nameless record.
- `CSVUploadModal` and `CSVListImportModal` call `setProgress(null)` right after the lookup without a session check. `CSVImportAllModal` already does `guard.check()` first.

## Goals / Non-Goals

**Goals:**
- Every client-side length rule matches the server's count.
- Lookups are made once per title per import.
- Retry and clamp on the Watchlist account for the watched reload state.

**Non-Goals:**
- Changing the backend's limits or skew.
- Handling a device clock more than 5 minutes behind the server. That row still gets the restore time, as today.
- Looking up a score for backup rows that have a poster. Item 44's decision stands.

## Decisions

1. **Code-point helpers in `csvParse.ts`.** Two small helpers:
   - `charLength(s)`: counts with `for…of`, which iterates by code point.
   - `cutChars(s, n)`: `Array.from(s).slice(0, n).join("")`.

   `parseTitle`, `parseBoundedText`, `parsePosterPath` and the review check use them. *Alternative:* `Intl.Segmenter` grapheme clusters. Rejected: the server counts code points, not graphemes, so graphemes would still disagree with it, and a grapheme cut could exceed 500 code points.

2. **Backup score from the lookup, without changing `lookupImportPosters`' contract.** `enrichPosterPaths` passes each row with `voteAverage` set to `undefined` when the row has no poster and its score is 0. Otherwise it passes the file's score. It then writes back both `posterPath` and `voteAverage` (the lookup's value, falling back to 0).
   - Only rows already going to TMDB for a poster gain a score, so no extra calls are made.
   - A real 0 on a poster-less row is replaced by TMDB's value, which for such a title is usually 0 or close to it anyway.

   *Alternative:* make `parseBackupCSV` leave a blank score `undefined`. Rejected: rows with a poster would then be looked up, which reverses item 44.

3. **Document the `ImportRow` contract.** A doc comment on `ImportRow.voteAverage` says `undefined` means unknown (looked up) and a number, 0 included, means given. On `posterPath` it says a missing, null or empty value means unknown.
   - The `||` for the poster stays, since an empty string is never a real poster.
   - The `??` for the score stays, since 0 is a real score.

   This closes finding 10 without a behavior change.

4. **Dedupe inside `lookupImportPosters`.**
   - Group the rows that need a lookup by `${type}:${mediaId}`, look up the first row of each group, and assign the result to every row in the group.
   - Progress totals count unique lookups.
   - `missing` becomes the number of distinct keys with at least one final row lacking a poster.

   All three importers get both fixes at once, and the backup's "saved without a poster" count stops counting per section. *Alternative:* dedupe only in `enrichPosterPaths`. Rejected: the CSV importers can have duplicate rows too, and the helper owns the rule (CLAUDE.md).

5. **5-minute leeway in `normalizeWatchedAt`.** The check becomes `when <= Date.now() + FUTURE_LEEWAY_MS`, with `FUTURE_LEEWAY_MS = 5 * 60_000`, commented as mirroring `BULK_TIMESTAMP_SKEW`. It applies to every caller (the Watched CSV and backup times), matching the server's own rule. A row from the far future is still dropped.

6. **Watchlist branches use the watched hook's `isLoading`.**
   - Read `isLoading: watchedLoading` from `useWatchedContext()`.
   - Render order:
     1. `!filterReady && watchedError && !watchedLoading` → LoadError
     2. `!filterReady` → skeleton
   - The clamp condition gains `&& !(watchedFilter !== "all" && watchedLoading)`.

   While a retry runs, the error and its Retry button aren't rendered, so repeated clicks can't start parallel reloads. *Alternative:* clear `error` at the start of `reload`. Rejected: a background reload failing after success relies on keeping state stable, and other consumers read `error`.

7. **No record means failed.** In the Movie, TV and Person loaders, when the main response's `data` isn't a plain object (`objectOr(data, null)`-style check), set `error = "failed"` and stop. This reuses the existing failed heading, Retry and title path. `PersonPage`'s `!person` render branch stays as a safety net.

8. **Guard after lookups.** `CSVUploadModal` and `CSVListImportModal` call `guard.check()` right after `lookupImportPosters` returns and before `setProgress(null)`, as `CSVImportAllModal` already does. The existing `SessionEndedError` catch drops the run silently.

## Risks / Trade-offs

- [Dedupe merges rows of one title whose files gave different posters] → Only rows that need a lookup are grouped. Each row's own file values still win in the merge, so a row with its own poster keeps it.
- [`charLength` iterates long reviews] → At most 5,000 characters per review, so the cost is negligible.
- [A poster-less backup row whose real score was 0 gets TMDB's current score] → Accepted (user decision). TMDB's value is the more current of the two.
- [Leeway lets a device-future time through that the server then rejects] → Only when the device clock is ahead of the server by more than about 5 minutes. That was already true for any time the device considered "now".
