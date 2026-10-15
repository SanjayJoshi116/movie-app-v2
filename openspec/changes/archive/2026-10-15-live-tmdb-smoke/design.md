## Context

See proposal.md for why. Today:

- Backend pytest (`backend/pytest.ini`, `-p pytest_dev_env`) loads `backend/.env`, which on the dev machine already holds a real `TMDB_API_KEY`. CI's backend job has no key. Tests live in `backend/userdata/tests/`, which `backend/.dockerignore` keeps out of the image.
- `backend/conftest.py` clears the `tmdb` and `person_credits` caches around every test.
- `test_e2e_mock_shapes.py` already reads frontend source (`src/types/domain.ts`) with regexes and fails on drift; it runs in normal CI with no network.
- Frontend TMDB requests are built in `src/api/tmdb.ts` (`append_to_response` lists for movie and TV detail), `src/pages/AnimePage.tsx` (`ANIME_KEYWORD`), `CalendarPage.tsx`, `HeroBanner.tsx`, `filtersToTMDBParams`. The fields the app reads are typed in `src/types/tmdb.ts`; the code guards optional ones (`?.`, `arrayOr`/`objectOr` in `utils/appended.ts`).
- Backend TMDB use: `tmdb_client` (`get_details_with_cast`, `discover`, `get_genre_names`, `_get`), `social_views._fetch_person_credits`, `metadata_backfill.fetch_entry_metadata`, and inline `_get` calls in `recommendations.py` (`/trending/all/week`, `/{type}/{id}/similar|recommendations`, hidden-gems discover, `/person/{id}/combined_credits`).
- `requests` puts the full URL, `api_key` included, in `HTTPError` messages. The log `RedactingFormatter` strips it from logs, but pytest prints exception text directly.

## Goals / Non-Goals

**Goals:**
- One file, opt-in, that a developer can run in about a minute and that names exactly what broke.
- A no-network drift check that keeps the file's copies of frontend parameters honest in every normal CI run.

**Non-Goals:**
- Query-sanity checks (Calendar coverage, sort quality, crew follows): items 35 and 36 add them to this file with their fixes.
- A CI job or repo secret.
- Checking TMDB *content* (that a given title has US providers, a certain cast); only presence and type.
- Browser-level checks: the proxy path covers what the browser asks for without a dev server.

## Decisions

**1. Backend pytest, one file, marker + module-level skip.**
`backend/userdata/tests/test_tmdb_live.py`, every live test marked `live_tmdb` (registered under `markers` in `pytest.ini`, so `pytest -m live_tmdb` selects them). A module-level `pytestmark` skip applies unless `RUN_LIVE_TMDB=1` *and* `settings.TMDB_API_KEY` is non-empty; the skip reason says which is missing. *Alternatives:* a Playwright spec (needs a running Django and a real key in the browser path, much slower); a standalone script (not "in the testing suite", easy to forget). The flag is required because the local `.env` already has a key: key-presence alone would put the network in every local `pytest` run.

**2. Frontend paths through the proxy view with Django's test client.**
`Client().get("/api/tmdb/<path>", params)` exercises what the browser hits: path, params, key injection, status passthrough. The autouse fixture empties the proxy cache, so every call goes upstream. About 20 proxy calls stay under `TmdbProxyThrottle`'s `120/min`. *Alternative:* calling TMDB directly with `requests` (skips the proxy, which is part of what the app depends on).

**3. Frontend parameters restated in one table, plus a no-network drift test.**
The values most likely to drift and costliest to miss are module constants (`MOVIE_APPEND`, `TV_APPEND`, `ANIME_KEYWORD`); every other frontend request's params sit in its test with a comment naming the source file. A second, unmarked test class (always runs, no network) regex-reads `src/api/tmdb.ts`'s two `append_to_response` strings and `AnimePage.tsx`'s `ANIME_KEYWORD` and fails, naming the request, when they differ from those constants. Same approach as `test_e2e_mock_shapes.py`. *Alternative:* parsing the TS for every param (brittle; only the values most likely to change and most costly to miss are cross-checked; the rest carry a source-file comment).

**4. Backend paths through backend functions.**
Call `tmdb_client.get_details_with_cast`, `tmdb_client.discover` with `genre_families.with_genres(...)`, `tmdb_client.get_genre_names(..., fallback=False)`, `social_views._fetch_person_credits`, and `metadata_backfill.fetch_entry_metadata` on an unsaved `WatchedEntry` (no DB). Inline `recommendations.py` requests that have no function of their own use `tmdb_client._get` with the same path and params, with a comment pointing at the source line. *Alternative:* extracting those inline calls into functions first (a refactor of production code for a test; not worth it here).

**5. A small declarative shape helper.**
`assert_shape(feature, path, obj, schema)` where a schema maps field → `(types, required)`; required means the app reads it unguarded, optional means it may be missing or null but must have the type when present. Lists check at least one item, and every item (up to 20) against the item schema. Messages read `"<feature> <path>: field '<name>' missing"` or `"... is str, expected number"`. Field lists come from what the app reads (`src/types/tmdb.ts` plus the backend readers), not every field TMDB returns. *Alternative:* JSON Schema or pydantic (a new test dependency for a small need).

**6. Stable fixture ids.**
Movie 550 (Fight Club, CLAUDE.md's reference id), TV 1396 (Breaking Bad: long-lived, has season 0 specials), person 287 (Brad Pitt: acting credits), person 525 (Christopher Nolan: crew-heavy, for item 36 later), search term "batman", Anime keyword `210024`. Checks assert presence and type of parts, not content (e.g. `watch/providers.results` is an object; not that `US` exists).

**7. No retries, and no key in failure output.**
Requests run once with the clients' existing timeouts (the proxy's 20 s deadline, `TMDB_TIMEOUT`). Backend calls are wrapped so a `requests` exception is re-raised with the API key replaced by `***` (reusing `RedactingFormatter`'s substitution), since pytest prints exception text and tracebacks, outside logging.

## Risks / Trade-offs

- [TMDB edits the fixture titles (a part becomes empty, specials removed)] → assert presence and type, not content; choose long-lived titles; a failure names the id so it can be swapped.
- [A field marked required is legitimately null for some results] → start from what the app reads unguarded; if the app *does* tolerate it, the schema says optional. A failure here may be a real app bug and is worth reading before relaxing.
- [Restated params drift for params the drift test doesn't parse] → each table row cites its source file; items that touch those requests (35's Calendar and sort changes) update the row in the same change.
- [Regex drift test breaks on a harmless refactor of `tmdb.ts`] → it fails with a message saying which constant to update; no false pass.
- [Opt-in checks rot if nobody runs them] → CLAUDE.md asks for a run before archiving any change that touches TMDB requests; a scheduled CI job stays an option.
- [API key in output] → Decision 7; proxy responses never contain the key.

## Migration Plan

Additive test and docs only. Nothing to deploy; remove the file to roll back.
