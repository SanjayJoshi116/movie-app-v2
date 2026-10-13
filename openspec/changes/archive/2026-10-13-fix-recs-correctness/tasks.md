## 1. Genre families (backend)

- [x] 1.1 Add `backend/userdata/genre_families.py` (design §1):
  - `FAMILY_OF`, the per-type `IDS` table, primary id first
  - `families(genre_ids)`, deduplicated
  - `with_genres(media_type, family_keys)`: `|` for one family, primary ids joined with `,` for several, `None` when a type lacks a family
  - `family_name(key, names)`
  - an unknown id becomes a family of its own for the type it came from
- [x] 1.2 Add `test_genre_families.py`:
  - every id in `STATIC_GENRE_NAMES` has a family
  - 28 and 10759 share a family
  - a movie tagged 28+12 counts once
  - `with_genres("tv", ["27"])` is `None`
  - `with_genres("movie", ["action-adventure"]) == "28|12"`
  - two families give primary ids joined with `,`
  - an unknown id round-trips

## 2. Recommendations use families (backend)

- [x] 2.1 Change `tmdb_client.discover(media_type, with_genres, page=1)` to take the prepared string, and update the mocks in `test_recommendation_refresh.py`.
- [x] 2.2 `_compute_for_you`:
  - count `families(...)` for `genre_count`/`loved_genre_count`
  - `discover_mixed(family)` queries only the types where `with_genres` isn't `None`
  - section keys are `genre-<family>` and labels use `family_name`
- [x] 2.3 `_compute_personalized`: a KMeans vocabulary over families, family vectors for the candidates, discover per type through `with_genres` (skipping `None`), and labels from `family_name`.
- [x] 2.4 Seeds: drop titles rated ≤ 4 from `because_source`; unrated titles stay eligible (design §6).
- [x] 2.5 Tests in `test_recommendations_api.py` (TMDB mocked, recording discover calls):
  - an action movie plus an action TV show give one section with both types, whose movie call uses `28|12` and TV call `10759`
  - a cluster `[action-adventure, 18]` queries movie `28,18` and TV `10759,18` and isn't dropped
  - a Horror-only section makes no TV call
  - a title rated 2 never seeds "Because you watched"

## 3. Stats uses families (backend)

- [x] 3.1 `stats_views`: Top Genres and Rating by Genre count `families(entry.genre_ids)` and name them with `family_name` over the cached names.
- [x] 3.2 Tests in `test_stats_math.py` or `test_stats_genres.py`:
  - two Action movies plus one Action & Adventure show give "Action & Adventure" 3 and no "Action"
  - a 28+12 movie counts once
  - Rating by Genre groups the same way

## 4. Rating changes refresh recommendations (backend)

- [x] 4.1 `ratings_list` POST: read the existing score first, then `schedule_refresh` when the rating was created or its score changed.
- [x] 4.2 `ratings_detail`: PATCH schedules a refresh only when `rating_changed`; DELETE always schedules one.
- [x] 4.3 `bulk_ratings`: add an `after_create` that schedules a refresh when `added`.
- [x] 4.4 Tests in `test_recommendation_refresh.py` (`captureOnCommitCallbacks`, `request_refresh` patched):
  - create, score change, delete and bulk-with-adds each schedule one refresh
  - a review-only PATCH and POST schedule none
  - a bulk import with nothing added schedules none
  - deleting the account schedules none

## 5. For You completeness and toggles (frontend)

- [x] 5.1 `RecommendationsPage.tsx`:
  - per-group state `pending | ready | gaveUp`, set only from responses
  - `complete` requires both polled groups `ready`, followed answered, and no error
  - after `MAX_POLLS` a group becomes `gaveUp`
- [x] 5.2 When any group is `gaveUp`, show an inline `Alert`, "Recommendations are taking longer than usual.", with Retry (the existing `retry()`), whether items are shown or not.
- [x] 5.3 Make the effect deps `[isDataLoading, hasWatched, retryToken]` with `hasWatched = watchedList.length > 0`.
- [x] 5.4 Add to `e2e/browse-restore.spec.ts` (with `page.clock` to run out the polls):
  - polling gives up: the notice and Retry show; leave and return, and the page fetches again
  - leave before the first answer: return, and it fetches again
  - marking a card watched sends no recommendation request and keeps the group order

## 6. Verify and record

- [x] 6.1 Run the checks:
  - backend `pytest`
  - `ruff check backend/`
  - `makemigrations --check --dry-run` (expect no changes)
  - `npm run typecheck`
  - `npm run lint`
  - `npx playwright test`
  - Jest
- [x] 6.2 Update `docs/BUG_BACKLOG.md`:
  - item 23 → 📝 now, ✅ at archive
  - record decision (23): rating changes refresh, and disliked titles don't seed
- [x] 6.3 Add a `docs/ARCHITECTURE.md` bullet on genre families (why a static table, and why primary ids for AND), plus a CLAUDE.md note in the recommendations area: count and query genres only through `genre_families`.
