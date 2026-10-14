## 1. Clustering input and split-type fallback

- [x] 1.1 `_compute_personalized`: rows only for entries with ≥1 family and rating missing or > 4; `[]` when fewer than 3; `k` from usable rows
- [x] 1.2 `_genres_for(media_type, top_families)`: pair first, then each family alone in order; used for both types
- [x] 1.3 Tests: ten horror titles rated 1–2 plus liked drama/comedy → no Horror label; genre-less titles don't change clusters vs. without them; fewer than 3 usable → no taste sections; Horror + Reality cluster → movie request with Horror ids only, TV request with Reality ids only, section non-empty

## 2. Rated titles never recommended

- [x] 2.1 `_compute_for_you` and `_compute_personalized`: exclusion set = watched ∪ rated pairs
- [x] 2.2 Tests: rated-not-watched title absent from For You and taste sections

## 3. Genre-less titles rechecked

- [x] 3.1 `WatchedEntry.metadata_checked_at`; migration `0028` with a data step unsettling settled, genre-less rows whose language isn't `"??"` (project Django env; `makemigrations --check` clean)
- [x] 3.2 `fetch_entry_metadata`: settled only on 404; `_store` stamps `metadata_checked_at`; `entry_needs_metadata` with `METADATA_RECHECK_DAYS = 30`
- [x] 3.3 Tests: 200 without genres → not settled, not refetched within 30 days (frozen clock), refetched after and year filled; 404 stays settled forever; migration data step: legacy 200-empty row unsettled, 404 row untouched (`MigrationExecutor`-free: call the step's function on a test DB state, or assert via a helper used by the migration)

## 4. Unknown genre ids on both types

- [x] 4.1 `family_of`: append the id to `IDS[family][media_type]` when missing
- [x] 4.2 Test: unknown id seen as movie then tv → `with_genres("tv", [family])` includes it; restore `IDS` after the test

## 5. Newest compute wins

- [x] 5.1 `UserRecommendationCache.source_started_at` (in migration `0028`); `save_recommendations(..., started=None)` with `select_for_update`, returns `"saved" | "kept_outage" | "superseded"`
- [x] 5.2 `_refresh_cache` and the warm-up pass `started`; backoff marker only on `"kept_outage"`; warm-up prints the outcome
- [x] 5.3 Tests: a save with an older `started` than the stored one is skipped (no backoff set); newer saves; `started=None` behaves as before; existing outage-guard tests updated for the outcome value

## 6. Docs and verification

- [x] 6.1 CLAUDE.md: settling rule (only 404 settles; genre-less rechecks after 30 days via `metadata_checked_at`); rated pairs excluded from candidates; `save_recommendations` outcome and `started`
- [x] 6.2 `docs/ARCHITECTURE.md`; CHANGELOG `[Unreleased]` (deploy note: migration 0028 with a data step); README test list if new files; `docs/BUG_BACKLOG.md` 28b → 📝 now, ✅ on archive
- [x] 6.3 `ruff check backend/`, `makemigrations --check --dry-run` (DEBUG=True), full backend pytest (in the background)
