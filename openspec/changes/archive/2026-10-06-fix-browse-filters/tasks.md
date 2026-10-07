## 1. Shared building blocks

- [x] 1.1 `src/constants/genres.ts`: rename `genres` → `movieGenres`, add `tvGenres` (TMDB `/genre/tv/list` ids, per design D1); update imports
- [x] 1.2 Add `src/utils/browseFilters.ts` with `hasActiveFilters(filters, sortBy, genres)` (ignores `includeAdult`; true on any value field, non-default sort, or ≥1 genre) and a local-date helper `todayLocalISO()` (no `toISOString()`)
- [x] 1.3 `filtersToTMDBParams` (`src/api/tmdb.ts`): for TV, map `original_title.asc` → `original_name.asc` and drop `with_runtime.*`
- [x] 1.4 Jest tests: `hasActiveFilters` (adult-only false, default sort false, genre true, value true) and `filtersToTMDBParams` (TV title sort mapping, TV runtime dropped, movie unchanged)

## 2. Filter scope and panel (App + FilterPanel)

- [x] 2.1 `App.tsx`: derive `filterScope` (`movie`/`tv`/`anime-tv`/`anime-movies`/`null`) from pathname + `animeMediaType`; with a `lastScopeRef`, reset `activeFilters`, `activeSortBy` and `clearGenres()` only when a non-null scope differs from the last one
- [x] 2.2 `FilterPanel`: accept `appliedFilters`/`appliedSortBy` props and seed draft state from them; render with `key={filterScope}` from `App.tsx`
- [x] 2.3 `FilterPanel`: render `isMovie ? movieGenres : tvGenres`
- [x] 2.4 `npx tsc --noEmit`

## 3. Browse pages (Home, Anime)

- [x] 3.1 `HomePage`: replace both `hasFilters` computations with `hasActiveFilters(externalFilters, externalSortBy, selectedGenres)`; on the discover branch add `with_genres`; remove `with_genres` from the category `baseParams`
- [x] 3.2 `AnimePage`: same `hasActiveFilters` change; keep `with_keywords` on every discover call; category branch only adds `with_genres` via the filters-active path
- [x] 3.3 `AnimePage`: "Airing Today" uses `air_date.gte`/`air_date.lte` = `todayLocalISO()` with `sort_by: popularity.desc` (remove the `first_air_date.desc` `SORT_MAP` entry)
- [x] 3.4 Add `src/utils/browseReturnState.ts` `stashReturnState(state)`: raw `window.history.replaceState({ ...cur, usr: { ...cur.usr, ...state } }, "")`, with a comment citing `@remix-run/router`'s `usr` field; Jest test asserts `usr` is merged and `key`/`idx` are kept
- [x] 3.5 `HomePage`/`AnimePage` `handleKnowMore`: call `stashReturnState({ scrollY, loadedPages, activeCategory, isReturn: true })` and then push the detail route as today (no replace-`navigate`); check for any other browse → detail navigation (e.g. HeroBanner, Recently Watched strip) and decide whether it needs the same stash
- [x] 3.6 `npx tsc --noEmit`

## 4. Search, For You, Login

- [x] 4.1 `SearchPage`: pass `active` to each tab; `usePaginatedSearch` keeps a per-tab `scrollYRef` updated by a passive scroll listener only while active, saves `scrollYRef.current` on unmount, and restores it when a mounted tab becomes active again
- [x] 4.2 `RecommendationsPage`: add `complete` to the saved cache (`!forYouComputing && !personalizedComputing && !loading`, read via the existing latest-data ref); an incomplete or old (no `complete`) cache seeds sections but leaves `hasFetched` false so the fetch/poll effect runs
- [x] 4.3 `LoginPage`: build `from` as `pathname + search + hash` from `state.from`, fallback `/movies`

## 5. Library pages and hooks

- [x] 5.1 `ListDetailPage`: `keyPrefix: \`listdetail_${listId}\``
- [x] 5.2 `useLibraryFilters`: match with `search.trim().toLowerCase()`; add a test case for trailing-space search
- [x] 5.3 `useWatched.addRaw`: prepend the new entry; update/add a `useWatched` test asserting the new entry is first
- [x] 5.4 `WatchedPage`: after load (`!isLoading && !error`), clamp `page` to `max(1, ceil(filtered.length / pageSize))` via `setPageState`
- [x] 5.5 Grep other `watchedList` consumers for order assumptions (Stats, Home strip, recommendations) and confirm prepend is correct for each

## 6. Tests and verification

- [x] 6.1 Run `npx tsc --noEmit` and the Jest suite (`npm test -- --watchAll=false`)
- [x] 6.2 `e2e/python/test_browse.py`: TV filter panel shows TV genres; category button changes results after an empty Apply; browser `go_back()` from a detail page restores category + scroll; update mocks if any route patterns change
- [x] 6.3 Run the Python e2e suite; fix any test that depended on the old shared genre list or `listdetail_*` keys
- [x] 6.4 Live check under `npm run dev` (StrictMode) with a throwaway Playwright `verify_*.py`: TV "Action & Adventure" returns results; Movies runtime filter doesn't reach TV request; browser Back restores Top Rated + 3 pages + scroll; Anime Airing Today has no future first-air dates; Search per-tab scroll; Watched page clamp; login redirect keeps `?tab=people`. Delete the script afterwards
- [x] 6.5 Update `docs/BUG_BACKLOG.md` status for #4 (📝 now, ✅ on archive) and add any design rationale worth keeping (D2 filter scope, D6 history-entry restore) to `docs/ARCHITECTURE.md`; update CLAUDE.md's genre/filter notes if conventions changed
