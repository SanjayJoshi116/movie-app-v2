## Why

Backlog item 23. All four findings were re-checked against 0.23.0 on 2026-10-13. Recommendations are quietly wrong in four ways:
- **Mixed genre ids.** TMDB genre ids are specific to a media type (Action is 28 for movies, while TV only has 10759 "Action & Adventure"). The backend pools both kinds in one id space and sends each id to both discover endpoints, so mixed sections lose half their titles. A taste cluster that lands on `[28, 10759]` asks TMDB for titles tagged with both (comma means AND), gets nothing, and the section disappears.
- **Ratings never refresh recommendations.** A rating can wait up to 12 hours to count, and a restored backup shows no "More like what you love" section until then.
- **A For You poll that gives up is saved as complete.** Groups still computing are then cached as final. The same happens when the user returns to an incomplete snapshot and leaves before the first response.
- **Every watched toggle on For You refetches all three groups** and restarts polling, so the sections reshuffle under the user.

## What Changes

**Genres are matched per media type (backend).**
- A new `genre_families` module maps TMDB's movie and TV genre ids into shared families, using TMDB's own names:
  - Action (28) and Adventure (12) with TV's Action & Adventure (10759)
  - Science Fiction (878) and Fantasy (14) with TV's Sci-Fi & Fantasy (10765)
  - War (10752) with TV's War & Politics (10768)
  - every genre id shared by both lists maps to itself
- For You's genre counts, "More like what you love", the "Based on your taste in …" sections and the KMeans vocabulary all count families, not raw ids.
- Discover calls translate each family into that media type's own ids: OR within a family, AND across families. A media type with no id for one of the families isn't queried, so Horror is never sent to `/discover/tv`.
- Stats' Top Genres and Rating by Genre use the same families, so one taste is no longer split into "Action" and "Action & Adventure".

**Ratings trigger a refresh (backend).** Decided 2026-10-13. Through `schedule_refresh`, coalesced per user like watched changes:
- creating a rating, or changing its score
- deleting a rating
- a bulk ratings import that adds at least one rating

A review-only edit doesn't trigger one. Neither does account deletion.

**Disliked titles don't seed "Because you watched" (backend).** Decided 2026-10-13. The recency seeds skip titles the user rated 4 or below. Unrated titles stay eligible.

**For You saves only complete results (frontend).**
- A poll that runs out of attempts leaves its group marked as still computing. The page says the recommendations are taking longer than usual and offers Retry, and the saved snapshot stays incomplete.
- A snapshot counts as complete only once every group has actually answered "ready" in this visit. Leaving before that saves it as incomplete.

**Marking a title watched on For You doesn't refetch (frontend).** The fetch effect depends on whether the user has any watched titles at all, not on how many. A toggle updates that card's icon and leaves the groups in place. The backend refresh it schedules shows up on the next visit.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `recommendation-refresh`: a new requirement that rating changes trigger a refresh.
- `recommendation-sections`: new requirements for media-type-correct genre sections and for keeping disliked titles out of the seeds.
- `view-state-restore`: the incomplete-snapshot requirement covers a poll that gives up and a visit left before the first response; a new requirement covers marking a title watched without refetching.
- `watch-stats`: a new requirement that genre charts group movie and TV equivalents.

## Impact

- **Backend:**
  - new `backend/userdata/genre_families.py`
  - `recommendations.py` (`_compute_for_you`, `_compute_personalized`)
  - `tmdb_client.discover`, which gets per-type id groups with OR inside a family
  - `stats_views.py`
  - `ratings_views.py`, which calls `schedule_refresh`
  - tests in `test_recommendations_api.py`, `test_recommendation_refresh.py` and `test_stats_*`, plus a new `test_genre_families.py`
- **Frontend:** `RecommendationsPage.tsx`, with Jest or Playwright coverage for the give-up path, the early leave and a toggle that doesn't refetch.
- **API:** response shapes are unchanged. Section keys for genre sections change from `genre-<tmdbId>` to `genre-<family>`. A cached For You response keeps its old keys until its next refresh, which is harmless because keys only need to be unique within one response.
- **No migration.** `TMDBMediaCache.genre_ids` and `WatchedEntry.genre_ids` keep raw TMDB ids, and families are derived when they're read.
