## 1. TMDB shape guards and shared genre names

- [x] 1.1 Add `tmdb_client.result_list(data, key)` (a list, dict entries with an int `id` only, else `[]`) and use it in `discover`
- [x] 1.2 Move Stats' cached genre-name lookup (state, TTLs, `GENRE_LOOKUP_TIMEOUT`/`GENRE_LOOKUP_DEADLINE`) to `tmdb_client.cached_genre_names()` under a lock; `stats_views` calls it; update the tests that patch the old names (`test_stats_genres`, `test_stats_math`, `test_local_dates`, `test_input_bounds`, `test_e2e_mock_shapes`, `test_tmdb_live`) and clear the cache in `conftest` if needed
- [x] 1.3 Tests: `result_list` on null, non-list, non-dict and id-less entries; the genre cache fetches once across two callers

## 2. Recommendation sections

- [x] 2.1 `filter_new(items, limit=12)` reserves only kept titles and dedupes within the section; drop the call sites' `[:12]`
- [x] 2.2 Personalized cluster loop dedupes candidates locally and adds only the 12 kept to `seen`
- [x] 2.3 Trending, similar/recommendations, gems and actor credits read lists through `result_list`
- [x] 2.4 `media_label(title, media_id)` helper; the "Because you watched" label uses it
- [x] 2.5 Both computes use `tmdb_client.cached_genre_names()` once; remove the dead `except TypeError`
- [x] 2.6 Tests: loved + same-family genre section both present with distinct titles; second cluster sharing a genre gets titles; null `results` in trending saves the other sections; non-dict actor credit ignored; blank seed title label

## 3. Refresh status and backfill

- [x] 3.1 `backfill_entries` returns False only for a fetch/store failure in this run, not for backoff skips; update its docstring
- [x] 3.2 `fetch_entry_metadata`: `genres` via `or []` with dict + int `id` entries only; `original_language` only when a string; log `type(e).__name__`
- [x] 3.3 `request_backfill` catches `RuntimeError` from `Thread.start()`, logs, and discards the user from `_running`
- [x] 3.4 `_recommendations_response`: no row + backoff, or no row and the refresh didn't start → `{"status": "unavailable", "sections": []}`
- [x] 3.5 `_fetch_media_details` warning logs only the exception type
- [x] 3.6 Tests: null genres stores none and the refresh saves; backoff-only title doesn't make a smaller result `KEPT_OUTAGE`; failed thread start leaves the user startable; `"unavailable"` with backoff and with a failed thread start; `"pending"` once backoff clears

## 4. Stats and genre families

- [x] 4.1 `monthly_counts` skips local dates before `EARLIEST_TIMESTAMP.year`
- [x] 4.2 `family_of` registers unknown ids under a module lock and records them in `FAMILY_OF`
- [x] 4.3 Tests: a year-1 watch doesn't extend monthly activity but still counts in totals; concurrent `family_of` for one new id on movie and TV registers both

## 5. Frontend

- [x] 5.1 `RecommendationsPage` treats status `"unavailable"` as that group failing (`fail(group)`, no further polls)
- [x] 5.2 Jest: an `"unavailable"` answer with nothing shown renders `LoadError` with Retry, not the computing or gave-up state

## 6. Docs and checks

- [x] 6.1 CLAUDE.md / `docs/ARCHITECTURE.md`: note the `"unavailable"` status, `cached_genre_names`, and the "reserve only shown titles" rule where recommendations are described; backlog item 60 linked as proposed, and add the deferred double-fetch entry
- [x] 6.2 Run backend pytest, ruff, `makemigrations --check`, Jest, typecheck, lint; run the live TMDB checks (`RUN_LIVE_TMDB=1 pytest -m live_tmdb`) since TMDB parsing changed; e2e only for specs touching Recommendations
