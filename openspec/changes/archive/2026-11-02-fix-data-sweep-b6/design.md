## Context

Backlog item 59 (sweep B6). All 9 findings were checked against the code. The `/security-review` found nothing at its bar. Its two leads, which this design addresses, are:
- **Stderr key leak:** real in principle (`tmdb_client._request` sends `?api_key=`, and `self.stderr.write` skips `RedactingFormatter`), but unreachable today, so it is hardening.
- **Rotation race:** a correctness problem.

While checking finding 2, a second gap showed up. `_recommendations_response` starts a refresh for any stale row through `request_refresh`, which coalesces only within one process (`_computing_users`). The cross-process `refreshing_since` stamp is read only for the `pending` status (`_is_refreshing`). So stamping the warm-up's user would make polls answer "pending", yet a poll would still start a second compute. The same holds between gunicorn workers today; `save_recommendations`' `source_started_at` check keeps only the newest result, but the TMDB work is still spent twice.

## Goals / Non-Goals

**Goals:**
- No duplicate compute between the warm-up and request-path refreshes, nor across processes generally.
- A rotation run never overwrites a concurrent session change.
- Warm-up output is redacted like the logs.
- The schema matches the queries that run.

**Non-Goals:**
- Loading each user's history only once per compute (finding 8): not fixed.
- Changing `REFRESH_STATUS_WINDOW` or the backoff rules.

## Decisions

1. **Rotation:**
   - `with transaction.atomic(): profiles = list(TMDBProfile.objects.select_for_update().exclude(session_id=""))`, then `bulk_update` inside the same block.
   - The `exclude(session_id="")` filter stays valid: an empty value is stored as `""`, never encrypted (`encrypt_session`).
   - A connect or disconnect then either commits before the lock (and is read) or waits for the rotation to commit.
   - Rows lock in one batch. The table is one row per connected user and an operator runs this rarely, so the short lock is acceptable.
2. **Warm-up claim:** `recommendations.claim_stale_refresh(user_id) -> stamp | None` runs one `UPDATE`:
   - `UserRecommendationCache.objects.filter(user_id=..., computed_at__lt=fresh_since).filter(Q(refreshing_since__isnull=True) | Q(refreshing_since__lte=now - REFRESH_STATUS_WINDOW)).update(refreshing_since=stamp)`.
   - It returns the stamp when one row changed, else `None`.
   - Being atomic, it closes the check-then-act gap the current `exists()` check has.
   - Users with no row (`rec_cache` null) are computed without a claim, as today. The command decides by whether a row exists.
   - The command clears in `finally` with `_set_refreshing_since(user_id, None, only_if=stamp)`.
   - The command doesn't touch `_computing_users`: that is per process, and the command is its own process.
3. **Request path honours the cross-process stamp:** `_recommendations_response` starts a refresh only when the row is stale, not in backoff, and `not _is_refreshing(user.id, cache_row)`.
   - A process killed mid-refresh leaves a stamp that blocks new refreshes for at most `REFRESH_STATUS_WINDOW`, which is that window's purpose. After it, polls start one.
   - Data-change triggers (`signals.py`, rating views) still call `request_refresh(rerun_if_running=True)` directly and aren't gated. Their result must reflect the new data, and `source_started_at` keeps the newest.
4. **Shared helper:** `compute_and_save(user) -> outcome` in `recommendations.py` holds `started`, `FetchHealth`, both computes and `save_recommendations`. `_refresh_cache` and the command both call it. It raises like today, and each caller keeps its own broad `except`.
5. **Redaction:** `userdata.logging.redact(text) -> str` holds the key and credential substitutions, and `RedactingFormatter.format` calls it. The command writes `redact(f"... failed: {e}")`.
6. **Schema:** one migration with these operations:
   - drop `db_index` on `WatchedEntry.watched_at` (`AlterField`);
   - `TMDBMediaCache.Meta.indexes = (models.Index(fields=["cached_at"], name="mediacache_cached_at_idx"),)`, declared in `Meta` as CLAUDE.md requires;
   - `media_type` gets `choices=MEDIA_TYPES` (`AlterField`, no SQL change).
   - Generate it with the Django 5.2 interpreter (`DJANGO_PYTHON`), never base Conda's Django 6.0.

## Risks / Trade-offs

- **A dead process's stamp delays new refreshes for up to `REFRESH_STATUS_WINDOW`.** The stored result is still served meanwhile, and that's an accepted cost of trusting the stamp.
- **Dropping the `watched_at` index:** any future query that filters on `watched_at` across users would scan. Today the only such query is per user. `test_list_indexes.py` ties library ordering to the composite index.
