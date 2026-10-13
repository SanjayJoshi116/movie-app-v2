## Context

The findings and the two decisions are in `proposal.md`. Today's state:

- **Genre ids are pooled.** `WatchedEntry.genre_ids` and `TMDBMediaCache.genre_ids` hold raw TMDB ids, which are specific to a media type. `_compute_for_you` counts them in one dict, and `discover_mixed(genre_id)` sends the same id to `/discover/movie` and `/discover/tv`. `_compute_personalized` builds its KMeans vocabulary from the pooled ids and calls `tmdb_client.discover(media_type, top_genre_ids)`, which joins the ids with `,`. Stats counts the same raw ids.
- **TMDB's genre lists:**
  - Shared by both types: 16, 35, 80, 99, 18, 10751, 9648, 37.
  - Movie only: 28, 12, 14, 36, 27, 10402, 10749, 878, 10770, 53, 10752.
  - TV only: 10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768.
  - TV merges Action and Adventure into 10759, Science Fiction and Fantasy into 10765, and War into 10768 (War & Politics).
- **TMDB `with_genres`** documents `,` as AND and `|` as OR. It doesn't document mixing the two in one value.
- **Refresh triggers.** `signals.schedule_refresh(user_id)` defers `request_refresh(..., rerun_if_running=True)` to commit. `bulk_import(..., after_create=...)` is how bulk watched schedules one.
- **For You fetch effect** (`RecommendationsPage.tsx`): `complete = !loading && !forYouComputing && !personalizedComputing && !fetchError`. On a cache-hit mount, `loading` starts `false` and both computing flags start `false`, so `complete` is true before anything has answered. The effect depends on `watchedList.length`.

## Goals / Non-Goals

**Goals:**
- One genre vocabulary in which every movie genre and TV genre has a place, used by recommendations and Stats.
- Correct ids per media type in every discover call.
- Rating changes refresh recommendations, using the existing coalescing.
- For You's "complete" means every group answered ready during this visit.

**Non-Goals:**
- No migration, and no change to the stored `genre_ids`.
- The frontend browse filters already map genres per type (`genresFor`), so they're untouched.
- Better genre labels for the movie-only and TV-only genres are out of scope (TMDB's names are used as they are).
- No new recommendation sections and no changes to the scoring weights.
- Rating-sync behavior with TMDB is item 25's.

## Decisions

### 1. Genre families: a static table, keyed by a family id
`backend/userdata/genre_families.py` holds:
- `FAMILY_OF: dict[int, str]`, mapping each TMDB genre id to a family key (`"action-adventure"`, `"scifi-fantasy"`, `"war-politics"`, otherwise `str(id)`)
- `IDS: dict[str, dict[str, list[int]]]`, giving each family's ids per media type, primary id first:
  - `"action-adventure"`: movie `[28, 12]`, tv `[10759]`
  - `"scifi-fantasy"`: movie `[878, 14]`, tv `[10765]`
  - `"war-politics"`: movie `[10752]`, tv `[10768]`
  - `"18"`: movie `[18]`, tv `[18]`
  - `"27"`: movie `[27]`, tv `[]`
- `families(genre_ids) -> list[str]`, deduplicated, so a movie tagged both 28 and 12 counts once.
- `with_genres(media_type, family_keys) -> str | None`:
  - **one family:** its ids for that type joined with `|` (OR)
  - **several families:** each family's *primary* id joined with `,` (AND)
  - **any family without an id for that type:** `None`, meaning don't query that type
- `family_name(key, names)`: the TV name for a merged family ("Action & Adventure"), otherwise the TMDB name of its single id.

Why these choices:
- **Static table.** TMDB hasn't changed its genre ids in years, and `STATIC_GENRE_NAMES` already hardcodes them. An unknown id gets a family of its own (`str(id)`), mapped for the media type it came from, so a new TMDB genre degrades to today's behavior and never crashes.
- **Primary ids for several families.** Mixing `|` and `,` in one `with_genres` value isn't documented. AND of the primary ids is documented, and close: an Action+Drama cluster asks movies for 28 AND 18.
- **Rejected:** separate movie and TV vocabularies. That would still split one taste in two, and the KMeans clusters would never span both types.

### 2. `tmdb_client.discover` takes the prepared `with_genres` string
The signature becomes `discover(media_type, with_genres, page=1)`, a string. The callers in `recommendations.py` build it with `genre_families.with_genres`. `discover_mixed(family)` queries a type only when `with_genres` is not `None`. KMeans clusters do the same per type. Labels and section keys use family keys: `genre-<family>` and `cluster-<n>`, as before.

### 3. KMeans and counts work on families
`all_genre_ids` becomes `all_families`. Candidate vectors use `families(c["genre_ids"])`, the raw ids of a TMDB result for that one media type, so cosine similarity compares like with like. `_add_or_merge_section`'s label-based merge keeps working, and labels now use family names.

### 4. Stats uses the same families
`stats_views` counts `families(entry.genre_ids)` for Top Genres and Rating by Genre, and names them with `family_name` over `_get_cached_genre_names()`. The averages keep `round_half_up`. Pinned by a new `watch-stats` scenario.

### 5. Rating refresh triggers live in the views, not in a signal
- **`ratings_list` POST:** `schedule_refresh` when `created`, or when the score differs from the one stored before. The view reads the existing row first, because `update_or_create` doesn't report the old value.
- **`ratings_detail` PATCH:** only when `rating_changed`, which the view already computes.
- **`ratings_detail` DELETE:** always.
- **`bulk_ratings`:** an `after_create` that schedules when `added`, the same as bulk watched.

Why the views:
- A `post_save` signal can't tell a review-only edit from a score change without an extra query.
- `post_delete` would also fire during account deletion's cascade (watched handles that with an `origin` check).

Restore order: the backup imports watched, then ratings. Each step's `schedule_refresh` coalesces with `rerun_if_running=True`, so the follow-up run after the ratings commit sees them.

### 6. Seeds skip disliked titles
`by_recency` filters out titles whose rating is ≤ 4. `by_rating` already sorts by rating, but with fewer than 3 rated titles it can still reach low ones, so the filter applies to the whole `because_source`. Unrated titles count as eligible. If filtering leaves no seeds, there's simply no "Because you watched" section.

### 7. For You completeness is tracked per group, as answered in this visit
- **Group state.** Each polled group gets a state, `"pending" | "ready" | "gaveUp"`. It starts `"pending"` and is set only from responses. `followed` counts as ready once answered.
- **Completeness.** `complete` is true only when for-you and personalized are `"ready"`, followed has answered, and there's no `fetchError`. A cache-hit mount that leaves before any answer therefore saves `complete: false`.
- **Giving up.** After `MAX_POLLS`, a group still pending becomes `"gaveUp"`. The page shows an inline `Alert` ("Recommendations are taking longer than usual.") with a Retry button that runs the existing `retry()`. The snapshot is saved with `complete: false`.
- **Rejected:** keeping the polling going forever. It costs a request every 3 s against `UserRateThrottle`.

### 8. The fetch effect depends on "has any watched", not the count
The deps become `[isDataLoading, hasWatched, retryToken]`, where `hasWatched = watchedList.length > 0`. A toggle on a card then doesn't rerun the effect, and the card's icon updates from `WatchedContext`. Going from 0 watched to 1 still triggers the first fetch. The StrictMode cleanup (`hasFetched.current = false`) stays as it is.

## Risks / Trade-offs

- **Merging Action and Adventure for movies loses a distinction in Stats.** A user who watches adventure films but not action films sees "Action & Adventure". → This is TMDB's own TV taxonomy and the spec names it. Movie-only genres keep their own names.
- **Primary-id AND is stricter than the family's OR** (Action+Drama doesn't match Adventure+Drama movies). → It's documented TMDB behavior. The single-family sections, which are most of For You, use the full OR.
- **More refreshes.** Each score change triggers one. → `request_refresh` coalesces to one running plus one queued per user, and a refresh is a few dozen TMDB calls in a background thread, already bounded by `save_recommendations`.
- **Old cached responses keep their old genre keys and labels** until the next refresh. → Keys are only unique within one response, and nothing reads `genre-<id>` (checked: no frontend consumer).
- **A static family table can lag a new TMDB genre.** → An unknown id becomes its own family for its own media type, so behavior degrades to today's, minus the cross-type bug.
