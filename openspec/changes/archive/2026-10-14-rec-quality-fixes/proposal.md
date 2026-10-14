## Why

Backlog item 28, second half (28b). The fifth audit found recommendation results that are wrong rather than expensive:

- **Personalized taste clusters are fit on bad rows.** Titles with no genres (settled, in backoff, or past the backfill cap) are zero vectors that pull every centroid toward the origin, and the result is saved as good for 12 hours. Titles rated 4 or below still get positive weight, so many horror films rated 1–2 can produce "Your Taste: Horror". Item 23 only stopped them seeding "Because you watched".
- **A cluster whose top two genres split across media types disappears.** Horror (movie-only) plus Reality (TV-only) can't be queried as a pair for either type, so the cluster yields no titles.
- **A title TMDB answers with no genres is settled forever.** New and unreleased titles often have no genres yet, and their release year stays unknown after release.
- **(plausible)** Titles the user rated but never marked watched can still be recommended.
- **(plausible)** A genre id TMDB adds later is registered only for the media type it was first seen on, so the same id is never queried for the other type.
- **(plausible)** An older recompute on one server process can overwrite a newer one from another.

The first half (28a, `bound-rec-refresh`) bounded how much refreshes cost. This half fixes what they compute.

## What Changes

- **Clustering input:** the personalized clustering uses only titles that have genres and weren't rated 4 or below. With fewer than 3 such titles there are no personalized sections.
- **Cross-type fallback:** when a cluster's top genres can't be queried together for a media type, that type is queried with each genre alone (top one first), so the cluster still yields titles.
- **Genre-less titles are rechecked:** only a TMDB "not found" settles a title for good. A title TMDB lists without genres is fetched again after 30 days, which also fills its release year once it's out. Existing rows settled that way (they have a real language) are rechecked once.
- **Rated titles count as seen:** titles the user rated, watched or not, are never recommended to them.
- **Unknown genre ids on both types:** an unknown genre id is registered for every media type it's seen on.
- **Newest compute wins:** a recompute's result is saved only if no recompute that started later has already saved.

Two schema changes, in one migration: `WatchedEntry.metadata_checked_at`, plus a data step that unsettles existing genre-less non-404 rows, and `UserRecommendationCache.source_started_at`. No API shape or frontend change.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `recommendation-sections`: taste clusters ignore genre-less and disliked titles, a split-type cluster falls back to single genres, and rated titles are never recommended.
- `title-metadata`: only a not-found answer settles a title for good; a genre-less answer is rechecked after 30 days.
- `recommendation-refresh`: a recompute never overwrites a result from a recompute that started later.

## Impact

- Backend: `recommendations.py`, `metadata_backfill.py`, `genre_families.py`, `management/commands/compute_recommendations.py`, `models.py` + migration `0028`.
- Tests: `test_recommendation_genres.py`, `test_genre_families.py`, `test_metadata_backfill.py`, `test_recommendation_refresh.py`, plus new cases.
- Docs: CLAUDE.md (settling rule), `docs/ARCHITECTURE.md`, CHANGELOG, `docs/BUG_BACKLOG.md` item 28b.
