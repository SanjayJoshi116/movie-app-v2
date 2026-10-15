## Why

Backlog item 35. The sixth audit found browse results that are wrong on real TMDB data even though every (mocked) test passes, plus a search term that leaks between pages. Three were confirmed against live TMDB on 2026-10-15:

- **The Release Calendar shows only today's movies.** It asks for the 7-day window sorted by date ascending and stops after 3 pages (60 titles). TMDB lists ~815 movies in that window, so the 60 all fall on day one; TV is cut off at day 5.
- **"Rating (High to Low)" returns junk.** No vote-count floor: the top results are 10.0 titles with one vote.
- **"Release Date (Newest)" starts in the future** (a 2099 placeholder, 2030s announcements); "Oldest" and "Title A–Z" open on 1870s shorts and punctuation-named uploads.
- **The search term leaks.** One app-wide term is shared by the Search page, the People page and the Movies/TV/Anime grids. A sidebar search makes People show "People results for …"; a People search changes the sidebar box; a Back-restore can land Movies in a search mode with no search box on the page to clear it.
- Smaller: the Calendar's iCal export ignores the title filter on screen, and the sidebar highlights nothing on sub-pages like `/lists/3`.

## What Changes

- **Calendar** asks for the window's most popular releases instead of the earliest ones, so every day of the window with notable releases shows up, and says it lists the most popular releases.
- **Sorts get sensible floors**: Rating needs a minimum vote count; Newest stops at today and needs a few votes; Oldest and Title A–Z need a minimum vote count. Floors live in one frontend constants module.
- **Searches stay where they were made**: the Movies, TV and Anime grids no longer have a search mode (searching always goes to the Search page, as the search box already does). The People page keeps its own term in its URL (`/people?q=`), so it survives Back and reload and never touches the global search box.
- **iCal export** contains only the titles the Calendar currently shows.
- **Sidebar and bottom nav** highlight the section a sub-page belongs to (`/lists/3` → My Lists).
- **Live checks** (from `live-tmdb-smoke`): the Calendar query covers more than its first day, the sort floors hold, Newest is never in the future, and a drift check keeps the test's copy of the floors equal to the frontend's.

## Capabilities

### New Capabilities
- `release-calendar`: what the Release Calendar lists for its window and how it says so.

### Modified Capabilities
- `browse-filters`: sort options return meaningful titles (floors); browse grids have no search mode, so the category-button and hide-watched requirements no longer refer to a grid search; the People page's search is its own and addressable by URL.
- `calendar-export`: the export holds exactly the titles shown.
- `routing`: navigation highlights the section of the current page, sub-pages included.
- `tmdb-live-checks`: the Calendar and sort queries are checked against live data.

## Impact

- Frontend: `src/api/tmdb.ts` (`filtersToTMDBParams`), new `src/constants/discover.ts` (floors), `CalendarPage.tsx`, `HomePage.tsx`, `AnimePage.tsx`, `Movies.tsx`/`TVShows.tsx` (search empty-state text), `PeoplePage.tsx`, `Sidebar.tsx`, `BottomNav.tsx`.
- Tests: Jest for `filtersToTMDBParams` and nav highlighting; e2e for Calendar export, People search URL and the sidebar; `backend/userdata/tests/test_tmdb_live.py` query checks and a floors drift check.
- Docs: CLAUDE.md (browse filters bullet), `docs/BUG_BACKLOG.md`, and the stale `genresFor` comment in `browseFilters.ts` (item 40) while that file is open.
- No backend or API change, no dependencies.
