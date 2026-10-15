## 1. Sort floors

- [x] 1.1 Add `src/constants/discover.ts` with `RATING_SORT_MIN_VOTES` (300), `NEWEST_SORT_MIN_VOTES` (10), `OLDEST_SORT_MIN_VOTES` (100), `TITLE_SORT_MIN_VOTES` (100)
- [x] 1.2 `filtersToTMDBParams`: add `vote_count.gte` by sort; for Newest set the date field's `.lte` to the earlier of `todayLocalISO()` and the year-to bound (movie and TV fields)
- [x] 1.3 Jest: each sort's params for movie and TV (floor present, Newest `.lte` = today or the earlier year-to end, Popularity unchanged)

## 2. Calendar

- [x] 2.1 `CalendarPage.tsx`: `sort_by: popularity.desc` for both media types (window and 3-page cap unchanged); subtitle "The most popular releases in the next 7 days"
- [x] 2.2 Export iCal from `filteredGroups`, and show the button only when `filteredGroups` has releases
- [x] 2.3 e2e: the calendar request uses `popularity.desc`; export with a title filter holds only the matching releases

## 3. Searches stay on their page

- [x] 3.1 `HomePage.tsx` and `AnimePage.tsx`: remove the search branch, the "Filters are disabled during search" alert, the search part of the category buttons' `disabled`, the search case of hiding watched titles, and the mount-time `setSearchTerm("")`
- [x] 3.2 `Movies.tsx`/`TVShows.tsx`: drop the `searchTerm` prop and its empty-state text
- [x] 3.3 `PeoplePage.tsx`: term from `?q=` (`useSearchParams`), input as local state seeded from it, search sets/removes `?q=` with `replace`; never reads or writes `UIContext.searchTerm`
- [x] 3.4 e2e: global search then People shows popular people; People search shows `?q=` and leaves the sidebar box empty; Back from a person keeps People's results; Movies → detail → sidebar search → Back twice shows the category grid

## 4. Navigation highlight

- [x] 4.1 `src/utils/navSection.ts` + Jest (exact match, sub-page prefix, `/movie/550` → none)
- [x] 4.2 Use it in `Sidebar.tsx` (`selectedKeys`) and `BottomNav.tsx` (`isActive`, `isMoreActive`)
- [x] 4.3 e2e: on `/lists/<id>` the sidebar's My Lists is selected

## 5. Live checks

- [x] 5.1 `test_tmdb_live.py`: floors as constants + always-on drift test reading `src/constants/discover.ts`
- [x] 5.2 Live: Calendar movie query (popularity, window) returns releases on at least 3 distinct days
- [x] 5.3 Live: rating sort (movie, TV, Anime) results all at or above the floor; Newest results never after the `.lte` sent; Oldest/A–Z results at or above their floors
- [x] 5.4 Update the Calendar shape check's params to the new sort

## 6. Verify

- [x] 6.1 `npm run typecheck`, `npm run lint`, Jest
- [x] 6.2 The e2e specs this touches (Calendar, People, browse-restore, sidebar) in both projects, and the Python `test_a11y_routing.py` People tests
- [x] 6.3 `RUN_LIVE_TMDB=1 pytest -m live_tmdb` passes; plain `pytest backend/` green; `ruff check backend/`
- [x] 6.4 Run the app (`npm run dev`) and check the Calendar spans the week, Rating/Newest sorts look sane, and the People/sidebar search no longer leak

## 7. Docs

- [x] 7.1 CLAUDE.md: browse-filters bullet (sort floors in `constants/discover.ts`, grids have no search mode, People's term is in its URL); nav highlight via `navSection`
- [x] 7.2 Fix the stale `genresFor` comment in `src/utils/browseFilters.ts` (backlog 40)
- [x] 7.3 `docs/BUG_BACKLOG.md`: item 35 → 📝 proposed, linked to this change
