## 1. Backend

- [x] 1.1 `stats_views.py`: constants `HOT_TAKES_MIN = 5`, `HOT_TAKE_GAP = 1.5`, `HOT_TAKES_LIMIT = 5`; a `rating_habits(watched_list, rating_map)` helper (qualifying titles: watched + rated + `0 < vote_average <= 10`; `avgOffset`/`contrarianScore` via `round_half_up`; lists sorted by gap, then title case-insensitive, then id; blank title → "Untitled (#id)"); add `ratingHabits` to the response
- [x] 1.2 Backend tests (new `test_stats_hot_takes.py`): below minimum (figures null, lists empty, count), the spec's 1.4 example, in-line case, unknown and >10 TMDB scores skipped, rated-but-unwatched skipped, 1.5 boundary included, limit 5, tie order, blank title label
- [x] 1.3 Python `MOCK_STATS` (`e2e/python/conftest.py`) gains `ratingHabits`; `test_e2e_mock_shapes` passes; ruff clean

## 2. Frontend

- [x] 2.1 `StatsData` (`src/api/userApi.ts`) gains `ratingHabits` with a `RatingHabitItem` type; TS e2e `stats()` helper gains a default
- [x] 2.2 `src/components/HotTakes.tsx`: habit sentence (±0.2 band → "in line"), contrarian score with `InfoTooltip`, guilty pleasures and not-for-you lists as `CardLink` rows (`POSTER_THUMB_URL` or `PosterPlaceholder`, `mediaLabel`, "You 9 · TMDB 5.2"), "none" text per empty list, below-minimum message with a link to `/watched/rate`; theme tokens, `FONT_SIZE`, scores shown to one decimal
- [x] 2.3 Render it as a Stats section (after the rating charts); Jest tests for the component (all states, wording, links, singular "1 more")

## 3. E2E and docs

- [x] 3.1 TS e2e in `e2e/stats.spec.ts`: hot takes render from a mocked response and a row links to its title; below-minimum message
- [x] 3.2 Checks: typecheck, lint, Jest, backend pytest (stats + mock shapes), ruff, touched e2e (stats TS + Python `test_stats.py`)
- [x] 3.3 Docs: README (features, tree, tests), `features.txt`, `ideas.md` item 3, CHANGELOG `[Unreleased]`, CLAUDE.md only for a new convention
