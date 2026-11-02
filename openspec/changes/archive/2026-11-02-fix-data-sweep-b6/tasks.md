## 1. Key rotation

- [x] 1.1 `rotate_tmdb_sessions`: read with `select_for_update()` inside `transaction.atomic()`, then `bulk_update` in the same block.
- [x] 1.2 Test: a profile disconnected after the command's read can't be overwritten. Either check that the queryset carries `select_for_update` and the write runs in one transaction, or simulate it with a patched read. Also test that the rotation still re-encrypts under the first key and counts unreadable rows.

## 2. Refresh dedup

- [x] 2.1 `recommendations.py`: add `compute_and_save(user)` and use it in `_refresh_cache`.
- [x] 2.2 `recommendations.py`: add `claim_stale_refresh(user_id)` (one conditional `UPDATE`: stale, no live stamp; returns the stamp or `None`).
- [x] 2.3 `_recommendations_response`: start a refresh only when the row is stale, not in backoff and not `_is_refreshing`.
- [x] 2.4 `compute_recommendations`:
  - Claim each user with a row, and skip when the claim fails (running elsewhere, or already fresh).
  - Compute users without a row as before.
  - Call `compute_and_save`, and clear the stamp in `finally` with `only_if`.
- [x] 2.5 Tests:
  - A claimed user's poll answers `pending` and starts no refresh.
  - A user made fresh after the list was read is skipped, with no compute call.
  - A live stamp is skipped.
  - A failed compute clears its own stamp but not a newer one.
  - The no-row user is computed.
  - The existing backoff tests still pass.

## 3. Redaction

- [x] 3.1 `logging.py`: extract `redact(text)` and use it in `RedactingFormatter.format`.
- [x] 3.2 `compute_recommendations`: write the failure line through `redact()`.
- [x] 3.3 Tests:
  - `redact()` replaces the key, `session_id`, `guest_session_id` and `request_token`.
  - A warm-up failure whose message carries `api_key=<key>` writes the placeholder.

## 4. Schema

- [x] 4.1 `models.py`:
  - drop `db_index=True` on `WatchedEntry.watched_at`;
  - add a `cached_at` index in `TMDBMediaCache.Meta.indexes`;
  - give `TMDBMediaCache.media_type` `choices=MEDIA_TYPES`.
- [x] 4.2 Generate the migration with the Django 5.2 interpreter, and check its header says 5.2. `makemigrations --check --dry-run` must be clean afterwards.

## 5. Docs and checks

- [x] 5.1 CLAUDE.md:
  - The recommendation-refresh bullet: a stale poll doesn't start a refresh while another process's `refreshing_since` stamp is live, and the warm-up claims users with `claim_stale_refresh`.
  - The `start.py` paragraph: the warm-up skip rule.
- [x] 5.2 Run, with `DEBUG=True` and the Django env interpreter: backend `pytest` (full), `ruff check backend/`, and `makemigrations --check --dry-run`.
- [x] 5.3 Update backlog item 59's status.
