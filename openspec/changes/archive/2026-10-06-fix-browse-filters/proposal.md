## Why

Browsing and filtering often show the wrong results, or forget what the user just did. Examples:
- Picking "Action" on the TV tab returns nothing, because the movie genre id is sent to TV discover.
- After any Apply, the category buttons stop working.
- Pressing the browser's Back button from a detail page throws away the user's category, loaded pages and scroll position.
- A newly watched title doesn't show up in "Recently Watched".

None of these crash; they just quietly show wrong or stale results. This is item 4 of `docs/BUG_BACKLOG.md` and is next in order now that `surface-failures` (#3) is archived.

## What Changes

One rule across browse, search and library pages: **what's on screen matches the filters the user can see, for the media type they're looking at, and coming back to a page puts them where they left it.**

### Browse filters (Movies, TV, Anime)
- **Genres per media type:** the filter panel shows TV genres (for example "Action & Adventure", "Sci-Fi & Fantasy") on TV and Anime-TV, and movie genres on Movies and Anime-Movies. Genre picks are cleared when the media type changes, so a movie-only id is never sent to TV discover.
- **Genres always apply:** choosing a genre switches the grid to TMDB discover. Category endpoints (now playing, top rated, etc.) ignore `with_genres`, so they no longer get it.
- **Filter detection:** "filters active" is true only when a real filter is set (year, rating, language, runtime, genre). `includeAdult: false` and the default sort no longer count. Category buttons keep working after Apply and after Reset.
- **Media-type-scoped filters:** applied filters belong to one media type. Moving between Movies, TV and the Anime TV/Movies toggle resets the filter state, so a hidden runtime filter can't carry over to TV. Movie-only sorts (`original_title.asc`) are mapped to the TV equivalent (`original_name.asc`) or omitted.
- **Anime "Airing Today":** shows only anime with an episode airing today, not anime sorted by newest first-air date (which included unaired shows).

### Returning to a page
- **Browser Back / swipe-back** from a detail page restores the browse page's category, Anime tab, loaded pages and scroll, the same way the in-app Back button does.
- **Search tabs** each keep their own scroll position. Leaving Search no longer saves the active tab's scroll into every tab's cache.
- **For You cache:** a snapshot taken while recommendations are still computing no longer stops polling for 5 minutes. The next visit resumes polling until the backend reports ready.
- **Login redirect** keeps the original query string and hash (for example `/search?tab=people`), not just the pathname.

### Library pages
- **List detail filters** are kept per list. Each list has its own search, sort and type filter instead of one set shared by every list.
- **Watched pagination** moves back to the last non-empty page when the current page empties (after unmarking or filtering), instead of showing a blank grid.
- **Library search** trims the query before matching, so `"matrix "` still finds "The Matrix".
- **Recently Watched** on Home shows newly watched titles first. New watched entries go at the front of the list, matching the server's newest-first order.

## Capabilities

### New Capabilities
- `browse-filters`: Movies/TV/Anime browse grids. Genre lists per media type, when filters count as active, filter scope per media type, and what each category returns.
- `view-state-restore`: Returning to a page restores its state. Covers browse pages via browser Back, Search per-tab scroll and the For You cache.
- `library-filters`: Library list views (Watchlist, Watched, List detail, Home Recently Watched). Filter scope per list, page clamping, search matching and recency order.

### Modified Capabilities
- `login-page`: adds a requirement that the post-login redirect preserves the full original location (path, query string and hash).

## Impact

- **Frontend only**, with no backend or API changes.
- **Files:**
  - `src/constants/genres.ts` (adds a TV genre list)
  - `src/components/layout/FilterPanel.tsx`
  - `src/App.tsx`
  - `src/api/tmdb.ts` (`filtersToTMDBParams`)
  - `src/pages/HomePage.tsx`
  - `src/pages/AnimePage.tsx`
  - `src/pages/SearchPage.tsx`
  - `src/pages/ListDetailPage.tsx`
  - `src/pages/WatchedPage.tsx`
  - `src/pages/RecommendationsPage.tsx`
  - `src/pages/LoginPage.tsx`
  - `src/hooks/useLibraryFilters.ts`
  - `src/hooks/useWatched.ts`
- **Storage:** sessionStorage keys change for List detail (`listdetail_<id>_*`). The old shared `listdetail_*` keys are simply ignored. The For You cache gets a `complete` field; old caches without it are treated as incomplete, so polling runs once more.
- **Tests:**
  - unit tests for `filtersToTMDBParams`, `useLibraryFilters` (trim) and `useWatched` (prepend)
  - e2e coverage in `e2e/python/test_browse.py` for TV genres, category buttons after Apply, and browser-Back restore
