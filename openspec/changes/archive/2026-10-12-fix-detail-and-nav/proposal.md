## Why

The 2026-10-09 third audit (backlog item 19) found a set of frontend bugs on the pages people use most: detail, browse, person and Following. A stray `0` shows on detail pages. The main browse grids' cards aren't links, which breaks the "no CardLink exceptions" rule. Back from Following lands on For You. A director's page shows only cameos. TV watch time counts one episode per series. Two of these were confirmed in the live Playwright run. The three open product decisions were settled on 2026-10-12, so the item can now be specified.

## What Changes

- **Detail facts**: runtime, season count and episode count render only when they are positive numbers. No stray `0`.
- **Where to Watch**: shows Streaming, Rent and Buy. When there is nothing to show, it says so for the US by name ("Not available to stream, rent or buy in the US") and never shows a header over nothing.
- **Browse cards are links**: the Movies/TV/Anime grid cards (`Movie.tsx`, `TVShowCard.tsx`) get a poster `CardLink`, using `onNavigate` to stash the return state. The hero "View Details" control and the notification items become real links too.
- **Back goes where you came from**: `RecCard`/`SectionRow` take the origin path from the host page, so Following → detail → Back returns to Following.
- **Person crew credits** (decision: a separate tab): a "Crew" tab lists the person's movie and TV crew credits, one card per title with their jobs joined. The default tab follows `known_for_department`, and credits are ordered newest first.
- **Mark as Watched runtime** (decision: editable and prefilled): the runtime input is editable for movies and TV. For TV it is prefilled with episodes × episode runtime when TMDB has both, and left blank otherwise. Runtime and providers come from one details request, so a providers failure no longer discards the runtime.
- **Browse grids hide watched titles** (decision: intended): this is specified and documented, not changed.
- **Smaller fixes**:
  - The Following recommendations refetch when the followed set changes, not only its length.
  - PersonPage's Follow button is disabled while the followed-people load has failed.
  - `AddToListModal` resets its text on close and tells loading or a failure apart from "No lists yet".
  - The CSV import templates list only the columns the import reads.
  - A multi-page Back-restore dedupes titles by id.
  - An in-flight notifications poll can't bring back a badge that was just marked seen.
  - The Sidebar and BottomNav search boxes share their recent searches.
  - Watchlist scroll restores only on a return from a detail page.
  - The Anime hero shows an anime (keyword-matched), or no hero at all.
  - The TMDB callback spinner shows its text.
  - CSV exports start with a UTF-8 BOM.
- Dropped from item 19 as already fixed: the hero `<img>` `loading="lazy"` (removed in `speed-up-pages`).

## Capabilities

### New Capabilities
- `title-details`: which facts a movie/TV detail page shows and how "Where to Watch" reports availability.
- `mark-watched`: what the Mark as Watched dialog prefills and lets the user edit, and how it degrades when part of its data is missing.
- `person-credits`: which credits a person page lists (cast and crew), in which tabs and order.

### Modified Capabilities
- `accessibility`: the "cards are links" requirement now names the browse grid cards, the hero's details control and notification items.
- `view-state-restore`: adds that Back returns to the originating page, that restored pages show each title once, that library scroll restores only on return, and that recent searches are shared.
- `browse-filters`: adds that browse grids hide watched titles (outside search), and that the Anime hero is an anime.
- `notifications`: adds that marking seen is not undone by a poll already in flight.
- `write-feedback`: Follow state consistency extends to the person page's Follow button under a load failure, and to the Following recommendations under changes to the followed set.
- `user-lists`: adds that the Add to List dialog starts clean and distinguishes loading or failure from "no lists".
- `data-backup`: adds that exported CSVs carry a UTF-8 BOM and that import templates list only the columns the import reads.

## Impact

- Frontend only, with no backend or API change:
  - Detail pages and their shared parts: `MovieDetails.tsx`, `TVShowDetails.tsx`, `WatchProviders.tsx`.
  - Cards and navigation: `Movie.tsx`, `TVShowCard.tsx`, `HeroBanner.tsx`, `NotificationBell.tsx`, `RecommendationsPage.tsx`, `FollowingPage.tsx`.
  - Person page and dialogs: `PersonPage.tsx`, `MarkWatchedModal.tsx`, `AddToListModal.tsx`, `CSVUploadModal.tsx`.
  - Hooks: `usePaginatedFetch.ts`, `useNotifications.ts`, `useRecentSearches.ts`/`useLocalStorage.ts`.
  - Other pages and utils: `WatchlistPage.tsx`, `AnimePage.tsx`, `TMDBCallbackPage.tsx`, `utils/export.ts`.
- `fetchMovieProviders`/`fetchTVWatchProviders` become unused, so they are removed. The e2e mocks for `/watch/providers` used by the mark-watched flow move to the details route.
- Docs: `CLAUDE.md` (the CardLink and MarkWatchedModal bullets), `docs/ARCHITECTURE.md` (hide-watched rationale), and the `docs/BUG_BACKLOG.md` status for item 19 and its open decisions.
