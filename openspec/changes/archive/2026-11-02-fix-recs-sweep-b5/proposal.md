## Why

The B5 module review (backlog item 60) found ten verified bugs in recommendations and Stats. Two of them are high severity. For You sections block each other's titles, so whole sections disappear. One `"genres": null` from TMDB makes every later refresh fail for that user. The rest cover misleading states ("pending" with nothing running, outage protection triggered by stale backoff), crashes on malformed TMDB lists, and small correctness gaps in labels, Stats and module state.

## What Changes

- **Sections only reserve the titles they show.** `filter_new` and the personalized cluster loop mark a title as seen only when it lands in a section's kept 12. Later sections can then still use the rest. Within one section, duplicates stay removed.
- **Malformed TMDB answers empty one thing, never the whole compute.**
  - The metadata backfill reads `genres` as `or []` and skips non-object entries.
  - For You's trending, similar, gems and actor-credit parsing, and `tmdb_client.discover`, accept only a list and only object entries with an integer id.
- **A title in failure backoff no longer marks a refresh as failed.** Only a fetch that failed in this run does, so removing history isn't refused as an outage because of an older failure.
- **No stored result plus a failure backoff answers `"unavailable"`, not `"pending"`.** The same applies when the refresh thread couldn't start. The Recommendations page shows its load-error state with Retry for that group instead of polling a minute and claiming it's still computing.
- **A failed backfill thread start releases the user.** `request_backfill` mirrors `_spawn_refresh`.
- **"Because you watched" names a blank title "Untitled (#id)"**, the same label the frontend's `mediaLabel` uses.
- **Stats' monthly activity starts no earlier than January 1900.** Legacy watches dated before then are left out of the monthly chart only, so one year-1 row can't produce ~24,000 empty months.
- **Genre family registration is lock-guarded** (`genre_families.family_of`).
- **Genre names are fetched once per day per process for recommendations too.** Stats' cached lookup moves to `tmdb_client` and both share it. The dead `except TypeError` around the old calls goes.
- **Hardening:** two TMDB warning logs record only the exception type, not its text (which carries the request URL).
- Not in this change: merging the two per-title TMDB fetches (`_fill_media_cache` and `backfill_entries`) into one call. It is logged as deferred in the backlog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recommendation-sections`: sections don't consume titles they don't show; a malformed TMDB list empties only its section; blank stored titles get a fallback label.
- `recommendation-refresh`: no result plus backoff (or no thread) is reported as unavailable; an earlier failure still in backoff doesn't mark a new compute failed.
- `title-metadata`: malformed `genres` doesn't abort a backfill; a failed thread start doesn't block later backfills.
- `watch-stats`: monthly activity starts no earlier than 1900.

## Impact

- Backend:
  - `backend/userdata/recommendations.py`, `metadata_backfill.py`, `genre_families.py`, `stats_views.py`, `tmdb_client.py`.
  - New response status value `"unavailable"` on `GET /api/recommendations/for-you/` and `/personalized/` (additive).
- Frontend: `src/pages/RecommendationsPage.tsx` treats `"unavailable"` as that group failing.
- Tests: backend recommendation, backfill, stats and genre-family tests; the RecommendationsPage Jest test; the touched e2e spec if one covers the gave-up state.
- No migration, no new dependency.
