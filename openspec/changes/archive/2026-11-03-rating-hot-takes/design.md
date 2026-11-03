## Context

- `GET /api/stats/` (`stats_views.stats`) already loads the user's whole watched list and a `rating_map` of `(media_id, media_type) → user_rating`, and computes every Stats figure server-side; `StatsPage.tsx` only renders. Figures round through `round_half_up` (one decimal).
- `WatchedEntry.vote_average` holds TMDB's score from when the title was added (0 = unknown; Stats' TMDB average already skips 0 and anything above 10). `RatingEntry` has no TMDB score, so a rated-but-unwatched title can't be compared without a TMDB call.
- `test_e2e_mock_shapes` fails when the Python `MOCK_STATS` keys differ from a real `/api/stats/` response; the TS e2e `stats()` helper is typed `satisfies StatsData`.

## Goals / Non-Goals

**Goals:**
- A small, honest comparison from data already stored, computed where every other Stats figure is.
- Stable output: same library, same lists, same order.

**Non-Goals:**
- Refreshing stale TMDB scores (a title's score is the one stored when it was added).
- Including rated-but-unwatched titles (would need TMDB calls per title).
- Sharing images of hot takes (`ideas.md` item 23).
- A per-genre or per-year breakdown of the gap.

## Decisions

1. **Computed in `stats_views`, returned as `ratingHabits`.** Keeps Stats one request and one source of truth, and the Python e2e mock shape test covers the new key. Alternative: compute in the browser from the watched and ratings contexts. Rejected: Stats doesn't use those contexts today, and splitting the page's data sources invites the two to disagree.

2. **Shape.** Always an object: `{ count, minCount, avgOffset, contrarianScore, guiltyPleasures: Item[], notForYou: Item[] }`, with `Item = { mediaId, mediaType, title, posterPath, userRating, tmdbRating, gap }` (`gap` = user − TMDB, one decimal). Below the minimum, `avgOffset` and `contrarianScore` are `null` and both lists empty, while `count` and `minCount` let the page say how many more are needed. One shape whatever the data, so the mock shape test always sees the same keys, and the page branches on `count < minCount`.

3. **Thresholds are constants in `stats_views`:** `HOT_TAKES_MIN = 5`, `HOT_TAKE_GAP = 1.5`, `HOT_TAKES_LIMIT = 5`, and the "in line" band ±0.2 lives in the frontend wording only (the API returns the number). Sort: gap descending (guilty) / ascending (not for you), then title (case-insensitive), then id, so output is deterministic.

4. **Rounding.** `avgOffset` and `contrarianScore` via `round_half_up` on the exact mean; each item's `tmdbRating` and `gap` rounded to one decimal for display; selection uses the unrounded gap.

5. **Frontend.** A new `src/components/HotTakes.tsx` (StatsPage is already ~800 lines), rendered as one more Stats section: habit sentence, contrarian score with `InfoTooltip` ("How far your ratings are from TMDB's, on average"), two lists of `CardLink` rows (poster via `POSTER_THUMB_URL` or `PosterPlaceholder`, `mediaLabel` title, "You 9 · TMDB 5.2"). Colors from theme tokens and `RATING_GOLD`; `FONT_SIZE` constants. Below the minimum: "Rate N more watched titles to see your hot takes" with a link to `/watched/rate`.

## Risks / Trade-offs

- **Stale TMDB scores** → a title added years ago compares against its old score. Accepted; noted in the tooltip ("TMDB scores as of when you added each title").
- **Half-point ratings vs one-decimal TMDB** → gaps like 1.45 round for display only; selection uses exact values, so a title at exactly 1.5 is included.
- **Large libraries** → one extra O(n) pass plus two small sorts over the qualifying list; negligible next to the existing Stats work.
