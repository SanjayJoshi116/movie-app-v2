## Context

Backend only. See proposal.md for motivation and `specs/` for requirements. Current code (re-checked 2026-10-14):

- `_compute_personalized` builds `X` with a row per watched entry (zero row when it has no families) and weights each row `rating / 10` (0.5 unrated), ratings 1–4 included. `k = max(2, min(4, len(watched) // 3))`.
- For each cluster, `genre_families.with_genres(type, top_families)` returns None when a type lacks an id for any family, and the type is skipped.
- `metadata_backfill.fetch_entry_metadata` returns `settled = not genre_ids` for a 200. `entry_needs_metadata` never looks at a settled row's genres again.
- `filter_new` (For You) and the personalized `watched_set` exclude only `WatchedEntry` pairs.
- `genre_families.family_of` registers an unknown id in `IDS[family]` only the first time, for the type it was seen with.
- `save_recommendations` does `update_or_create` unconditionally (after the outage guard). Two processes can each run a refresh for one user: coalescing is per process, and the cross-process stamp only reports status.

## Goals / Non-Goals

**Goals:** the six behaviors in the specs, with no extra TMDB calls in the common path.

**Non-Goals:**
- Negative weights for disliked titles in KMeans. Excluding them is simpler and avoids negative centroids, which cosine scoring handles badly.
- Recommending around disliked titles ("less like X").

## Decisions

1. **Clustering rows.** Keep only entries with ≥1 family whose rating is missing or > 4. Use the existing weight `rating / 10`, default 0.5. With fewer than 3 usable rows, return `[]`. Compute `k` from the usable rows. The candidate exclusion set (decision 4) still covers every watched and rated title, including the ones dropped from `X`.

2. **Split-type fallback.** A helper `_genres_for(type, top_families)` tries `with_genres(type, top_families)`, then each family alone in order, and returns the first non-None. The label stays the cluster's top genres ("Horror & Reality"), because that is the user's taste. Each type's candidates match one of them, and scoring by cosine similarity still ranks them.
   - *Alternative:* drop the second family from the label. Rejected: the label describes the cluster, and both families are present in the section across the two types.

3. **Settling and rechecks.**
   - `fetch_entry_metadata` returns `settled=True` only for a 404. A 200 with no genres returns `settled=False`.
   - `_store` always sets `metadata_checked_at = now()`.
   - `entry_needs_metadata`:
     - Settled: language or year missing (unchanged).
     - Not settled: language or year missing, or no genres and (`metadata_checked_at` is null or older than `METADATA_RECHECK_DAYS = 30`).
   - Migration `0028`:
     - Adds `metadata_checked_at`.
     - A data step sets `metadata_settled=False` (with null `metadata_checked_at`, so they are due once) on rows with `metadata_settled=True`, empty `genre_ids` and `original_language` other than `"??"`. Those are the 200-without-genres rows; 404s are stored with `"??"`.
   - A title that really has no language and no genres was stored as `"??"` too and stays settled. That is acceptable: such rows are vanishingly rare, and it only means no recheck.
   - The data step runs on the whole table in one `UPDATE`. It is a filtered update on a boolean plus JSON-empty check, cheap enough.
   - Rechecks go through the existing per-run cap and the per-user daily budget (28a), so the one-time recheck of legacy rows can't burst.

4. **Rated pairs.** `seen_pairs = watched ∪ rated` (from the `RatingEntry` query each compute already makes) replaces `watched_set` in `filter_new` and the personalized candidate filter.

5. **`family_of`.** When the family already exists but `media_type` is known and the id is missing from `IDS[family][media_type]`, append it. With no `media_type`, keep registering both types as today. `IDS` is process memory: the change only affects ids not in the static tables.

6. **Newest compute wins: `UserRecommendationCache.source_started_at` (nullable).**
   - `_refresh_cache` and the warm-up take `started = timezone.now()` before computing and pass it to `save_recommendations(..., started=...)`.
   - The save runs in `transaction.atomic()` with `select_for_update()` on the user's row:
     - If a row exists and its `source_started_at` is newer than `started`, skip, log, and return False.
     - Otherwise write, setting `source_started_at=started`.
   - A row-less first save can race between two processes. `update_or_create` already handles that (one wins), and either result is equally fresh.
   - A save skipped this way is not a TMDB failure: `_refresh_cache` must not set the 28a backoff marker. So `save_recommendations` returns an outcome (`"saved" | "kept_outage" | "superseded"`), and only `"kept_outage"` sets the marker. Callers that only checked truthiness are updated: the warm-up command prints the outcome.
   - `started=None` (old callers, tests) keeps today's behavior.

## Risks / Trade-offs

- **Excluding disliked titles can leave very small libraries with no taste sections.** → That is the honest result. For You still has its other sections.
- **The legacy-row recheck refetches titles once.** → Bounded by the per-run cap and the daily budget.
- **`select_for_update` in the save adds a lock** held only for one row write. → Negligible.

## Migration Plan

Migration `0028`: two nullable fields plus one data `UPDATE` (reversible as a no-op). Rollback: revert. Unsettled rows simply get fetched again, which is harmless.
