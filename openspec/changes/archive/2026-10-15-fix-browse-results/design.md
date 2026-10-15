## Context

See proposal.md for why. Today:

- `filtersToTMDBParams` (`src/api/tmdb.ts`) turns the filter drawer's values and sort into discover params. It maps movie date sorts to TV's `first_air_date` and A–Z to `original_name`, but adds no vote floor or date bound. Home, TV and Anime all send discover through it whenever filters or a non-default sort are active (`hasActiveFilters`). Anime's own "Top Rated" category already sends `vote_count.gte: 50`.
- `CalendarPage.tsx` fetches discover for today..+7 days sorted by date ascending, at most 3 pages per media type, groups by date, and exports `groups` (all loaded) to iCal.
- `UIContext.searchTerm` is shared by `SearchBox`/`SearchPage`, `PeoplePage` (reads and writes it, no reset), and `HomePage`/`AnimePage` (search branch in `fetchPage`, an "Filters are disabled during search" alert, category buttons disabled, watched titles shown). The search box always navigates to `/search`, so the grids' search branch is reachable only through the leak.
- `Sidebar.tsx` uses `selectedKeys={[location.pathname]}`; `BottomNav.tsx` compares `location.pathname === item.path`.
- `backend/userdata/tests/test_tmdb_live.py` (archived `live-tmdb-smoke`) holds opt-in live checks and always-on drift checks that regex-read frontend source.

Measured against live TMDB on 2026-10-15 (window today..+7):

| Query | Result |
|---|---|
| Calendar movies, date asc, 3 pages | all 60 on day one (815 in window) |
| Calendar movies, popularity desc | page 1 already spans all 7 days; page 3 still 6 days, ~19/20 with posters |
| `region=US` + `with_release_type=2\|3` with `primary_release_date` | 813: region ignored for that field |
| Rating sort, `vote_count.gte` 100 / 300 | 9.9 obscure titles / recognisable; Anime keeps 226–257 results at 300 |
| Newest, `lte` today | today's 0-vote uploads; with `vote_count.gte` 10: real recent releases |
| Oldest / A–Z with `vote_count.gte` 100 | 1874–1888 film history / `"MANOS"`, `#Horror`: acceptable |

## Goals / Non-Goals

**Goals:** sensible results for every sort and the Calendar on real data; one source for the floors; searches that stay on their page; checks that keep it that way.

**Non-Goals:** a region setting (item 40); per-day Calendar paging or a "load more"; changing what Popularity or the category buttons return; the Search page's own behaviour.

## Decisions

**1. Floors in one constants module, applied in `filtersToTMDBParams`.**
`src/constants/discover.ts` exports `RATING_SORT_MIN_VOTES = 300`, `NEWEST_SORT_MIN_VOTES = 10`, `OLDEST_SORT_MIN_VOTES = 100`, `TITLE_SORT_MIN_VOTES = 100`. `filtersToTMDBParams` adds `vote_count.gte` by sort key, and for Newest sets the date field's `.lte` to the earlier of today (`todayLocalISO()`, the device's day) and the year-to bound. The same values apply to movies and TV, so Anime's filter path gets them too (Anime keeps 200+ results at 300). *Alternatives:* TMDB's `/top_rated` endpoints (can't combine with filters); per-media-type floors (no measured need).

**2. Calendar: popularity within the window.**
Same window and 3-page cap, `sort_by: popularity.desc` for both types, then group by date as now. The subtitle says "The most popular releases in the next 7 days". *Alternatives:* a region/release-type filter (doesn't apply to `primary_release_date`, and re-releases leak in); one request per day (14+ requests per load against the proxy throttle); a vote floor (upcoming titles have almost no votes).

**3. iCal exports `filteredGroups`.**
The button exports and is shown for what's on screen.

**4. Grids lose their search mode; People's term moves to its URL.**
`HomePage`/`AnimePage` drop the `searchTerm` branch, the alert, the search part of the category-button `disabled`, and the "show watched while searching" case; they stop reading `searchTerm` and no longer clear it on mount. `Movies`/`TVShows` lose the `searchTerm` prop and its empty-state text. `PeoplePage` reads its term from `?q=` (`useSearchParams`), keeps the input as local state seeded from it, and on search sets `?q=` (or removes it) with `replace`, so Back from a person returns to the same URL and `usePaginatedFetch`'s restore keeps working. It never calls `setSearchTerm`. `UIContext.searchTerm` stays, used by the search box and Search page only. *Alternative:* resetting the global term on every grid/People mount (keeps one shared value whose meaning depends on the page; the Back-restore path would still read a stale term).

**5. One section helper for both navs.**
`src/utils/navSection.ts` `navSection(pathname, keys)` returns the key equal to the pathname, else the key that the pathname starts with followed by `/` (`/lists/3` → `/lists`), else null. Sidebar `selectedKeys` and BottomNav `isActive`/`isMoreActive` use it. `/movie/550` matches nothing because `/movies` isn't a prefix of `/movie/`.

**6. Live checks reuse the archived file's approach.**
`test_tmdb_live.py` gets the floors as constants plus an always-on drift test that regex-reads `src/constants/discover.ts`. Live tests (marked, opt-in) send the Calendar query and each sort's params built the same way as `filtersToTMDBParams` and assert: movie results on at least 3 distinct days of the window; every rating-sorted result at or above the floor; no newest-first result after the `.lte` date sent. 

## Risks / Trade-offs

- [A floor hides a legitimately interesting low-vote title] → floors apply only to the non-default sorts that were returning junk; Popularity and the categories are untouched.
- [Calendar shows at most 60 titles per type] → stated in the subtitle; a quiet day can still have none, which is honest.
- [The device's today vs TMDB's dates] → same `todayLocalISO()` the Calendar already uses; a title released "today" elsewhere may show a day early or late.
- [Removing the grid search mode drops a behaviour some test relied on] → no Jest or e2e test exercises it (checked); the browse-filters spec is updated in this change.
- [Live calendar check depends on that week's releases] → threshold of 3 distinct days, far below the 7 measured.

## Migration Plan

Frontend-only; ships with the next build. Old `?q=`-less People URLs keep working.
