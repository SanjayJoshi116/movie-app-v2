## 1. Scaffolding

- [x] 1.1 Register a `live_tmdb` marker in `backend/pytest.ini` (`markers = live_tmdb: ...`)
- [x] 1.2 Create `backend/userdata/tests/test_tmdb_live.py` with a module-level skip unless `RUN_LIVE_TMDB=1` and `settings.TMDB_API_KEY` is non-empty; the reason names what's missing. Live tests carry the `live_tmdb` marker
- [x] 1.3 Add `assert_shape(feature, path, obj, schema)` (field → (types, required); lists need ≥1 item and check up to 20) with failure messages naming feature, path and field
- [x] 1.4 Add a wrapper for backend TMDB calls that re-raises `requests` exceptions with the API key replaced by `***`
- [x] 1.5 Add the drift-checked frontend constants (`MOVIE_APPEND`, `TV_APPEND`, `ANIME_KEYWORD`; other params inline per test with a source comment) and the fixture ids (movie 550, TV 1396, persons 287 and 525, query "batman", Anime keyword 210024)

## 2. Drift check (no network, always runs)

- [x] 2.1 Unmarked test class that regex-reads `src/api/tmdb.ts`'s movie and TV `append_to_response` strings and `src/pages/AnimePage.tsx`'s `ANIME_KEYWORD`, and fails naming the request when they differ from the constants
- [x] 2.2 Confirm it fails when a part is added to one side only, then revert

## 3. Frontend shape checks (through `/api/tmdb/` with the test client)

- [x] 3.1 Browse grids: movie/TV categories (`popular`, `top_rated`, `now_playing`, `upcoming`, `on_the_air`, `airing_today`), discover with filter params, Anime discover (TV and movie with `with_keywords`): `results[]` items and `total_pages`
- [x] 3.2 Search: movie, TV and person search with `include_adult`
- [x] 3.3 Calendar: movie and TV discover over a date window (shape only)
- [x] 3.4 Hero banner: `trending/{movie,tv}/week` and Anime discover, backdrop fields
- [x] 3.5 Movie detail (550) with the full `append_to_response`: every part present with its expected type, plus the fields Mark as Watched reads (`runtime`, `release_date`, `original_language`, `watch/providers`)
- [x] 3.6 TV detail (1396) with the full `append_to_response`, plus `number_of_episodes`, `episode_run_time`, `last_episode_to_air`, `seasons[]`
- [x] 3.7 Episode guide: a regular season and season 0 (specials) of 1396
- [x] 3.8 Person page: `person/{id}`, `movie_credits`, `tv_credits` (cast and crew), `images`, `combined_credits` for 287 and 525

## 4. Backend shape checks (through backend functions)

- [x] 4.1 Recommendations: `get_details_with_cast` (movie and TV), `discover` with `genre_families.with_genres`, and the inline `_get` requests in `recommendations.py` (trending all, similar, recommendations, hidden gems, combined credits) with source-line comments
- [x] 4.2 Follows and notifications: `social_views._fetch_person_credits` for 287 returns trimmed credits with ids, media types and dates
- [x] 4.3 Stats: `get_genre_names(..., fallback=False)` for movie and TV
- [x] 4.4 Metadata backfill: `fetch_entry_metadata` on an unsaved `WatchedEntry` (movie and TV) returns genres, language and a year, not settled

## 5. Verify

- [x] 5.1 `RUN_LIVE_TMDB=1 pytest -m live_tmdb` passes against live TMDB; record the run time
- [x] 5.2 Plain `pytest` skips every live check with the "not opted in" reason and makes no TMDB request (check with the flag unset and the local key present)
- [x] 5.3 With the flag set and the key emptied, the skip reason names the missing key
- [x] 5.4 Force one failure (e.g. a bogus required field) and confirm the message names feature, path and field, and contains no API key; revert
- [x] 5.5 `ruff check backend/` passes; full backend pytest still green

## 6. Docs

- [x] 6.1 README Testing: the live check, how to run it, that it's skipped by default and in CI
- [x] 6.2 CLAUDE.md Verification: how to run it; any new TMDB-reading feature adds a shape check; run it before archiving a change that touches TMDB requests; items 35/36 add their query checks here
- [x] 6.3 `docs/BUG_BACKLOG.md`: item 41 → 📝 proposed, linked to this change
