## Why

The B6 module sweep (`backend/userdata/models.py`, `migrations/`, `management/commands/`; backlog item 59) found 9 issues, all confirmed against the code:
- Rotating the TMDB session keys can write an old session back over a disconnect or reconnect that happened during the run.
- The startup recommendation warm-up doesn't mark the users it computes as refreshing, so a For You visit during warm-up starts the same TMDB-heavy compute again. It also recomputes users whose recommendations became fresh after it read its list.
- The warm-up's error output skips the log redaction.
- An index is never used, another is missing, and one column lacks its type constraint.

The `/security-review` found no exploitable issue: the error output can't contain the TMDB key today, so that fix is hardening.

## What Changes

- **Key rotation locks the rows it re-encrypts**, so a connect or disconnect that commits during the run is never overwritten.
- **The startup warm-up claims each user before computing.**
  - One conditional update marks the user as refreshing, and only when no refresh is running and the stored result is still stale. Otherwise the user is skipped.
  - When the compute ends it clears only its own mark.
  - Request-path refreshes then see the warm-up's compute and don't start a second one.
- **One shared compute-and-save helper** is used by both the background refresh and the warm-up, so the two can't drift apart.
- **Warm-up error output is redacted** with the same rules as the log formatter (TMDB key, session ids, request tokens), through a `redact()` function split out of `RedactingFormatter`.
- **Schema tidy-up, in one migration:**
  - Drop the unused single-column `WatchedEntry.watched_at` index; the per-user composite index covers its only query.
  - Index `TMDBMediaCache.cached_at` for the startup prune.
  - Give `TMDBMediaCache.media_type` `choices=MEDIA_TYPES`, like every other media type column.
- **Not fixed:** the warm-up loading each user's history twice. Two DB reads are small next to the TMDB time, and the background refresh does the same.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-security`: key rotation doesn't overwrite a concurrent connect or disconnect.
- `recommendation-refresh`: the startup warm-up doesn't duplicate a running refresh, and doesn't recompute a user who is already fresh. A stale poll doesn't start a refresh while another process's refresh is marked running.
- `api-hardening`: the "no log output contains the TMDB API key" rule covers management command output.

## Impact

- **Backend only:**
  - Commands: `management/commands/rotate_tmdb_sessions.py` and `compute_recommendations.py`.
  - `recommendations.py`: the shared helper and the claim/clear helpers.
  - `logging.py`: `redact()`.
  - `models.py`, plus a new migration (`AlterField` + `AddIndex`/`RemoveIndex`; no data change).
- **Tests:** `test_startup_warmup.py` (claim, skip, clear), a rotation test, `test_logging.py` (`redact()`), and `test_list_indexes.py` if it checks indexes. Plus ruff and `makemigrations --check`.
- No API, frontend or dependency change.
