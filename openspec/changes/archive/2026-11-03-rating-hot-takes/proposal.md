## Why

Stats shows what you watched, but nothing about how your taste compares with everyone else's. Every watched title already stores TMDB's community score (`WatchedEntry.vote_average`) next to your own rating, so the gaps between the two ("you gave it 9, TMDB 5.2") are free to compute and make a fun, personal section. It is `ideas.md` item 3, and pairs with the new rating queue: more ratings, more hot takes.

## What Changes

- **New "Hot takes" section on Stats**, built from titles you have both watched and rated, whose TMDB score is known:
  - **Rating habit**: "You rate 1.4 above TMDB on average" (or "below", or "in line with TMDB" within ±0.2).
  - **Contrarian score**: your average distance from TMDB's score, e.g. "1.8", with a one-line tooltip.
  - **Guilty pleasures**: up to 5 titles you rated highest above TMDB (gap at least 1.5), each "You 9 · TMDB 5.2", linking to the title.
  - **Not for you**: up to 5 titles you rated furthest below TMDB (gap at least 1.5).
- **Shown from 5 qualifying titles**; with fewer, the section says how many more rated titles it needs. An empty list (no gap of 1.5 either way) says so instead of disappearing.
- **The stats API adds `ratingHabits`** (computed in `stats_views`, like the rest of Stats): always `{count, minCount, avgOffset, contrarianScore, guiltyPleasures[], notForYou[]}`; below the minimum the figures are `null` and the lists empty. Additive; no migration, no TMDB call.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `watch-stats`: adds the Hot takes requirements (which titles count, the minimum, the habit and contrarian figures, the two lists and their thresholds).

## Impact

- Backend: `backend/userdata/stats_views.py` (one more pass over watched + ratings already loaded), tests in `test_stats_math.py` or a new `test_stats_hot_takes.py`.
- API: `GET /api/stats/` gains `ratingHabits` (additive). `StatsData` in `src/api/userApi.ts`; the Python `MOCK_STATS` and the TS stats e2e helper gain the key (`test_e2e_mock_shapes` compares them with a real response).
- Frontend: a new section in `StatsPage.tsx` (or a small `HotTakes` component), using `CardLink`, `PosterPlaceholder`, `POSTER_THUMB_URL`, `InfoTooltip`, theme tokens.
- Docs: README features/tree, `features.txt`, `ideas.md`, CHANGELOG.
