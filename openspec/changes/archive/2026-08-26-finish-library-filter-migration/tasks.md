## 1. Widen `useLibraryFilters`

- [x] 1.1 Add optional `getTitle?: (item: T) => string` and `getType?: (item: T) => MediaType` params to `Options<T>`; drop the `T extends LibraryItem` constraint.
- [x] 1.2 Update the internal filter pipeline: title search uses `getTitle ?? ((i) => (i as any).title)`; type filter only runs `if (getType && typeFilter !== "all")`.
- [x] 1.3 Confirm `WatchlistPage.tsx`/`WatchedPage.tsx`/`ListDetailPage.tsx` need no call-site changes (defaults reproduce current behavior) — `npx tsc --noEmit` must stay clean with zero edits to those three files.

## 2. Widen `MediaGrid`

- [x] 2.1 Add optional `colSpan?: { xs?: number; sm?: number; md?: number; lg?: number }` prop, merged over the current `{ xs: 12, sm: 8, md: 6, lg: 4 }` defaults.
- [x] 2.2 Confirm `WatchlistPage.tsx`/`WatchedPage.tsx` need no call-site changes.

## 3. Migrate `ListsPage.tsx`

- [x] 3.1 Replace hand-rolled `search`/`sortKey` `useState` + sessionStorage `useEffect`s + filter/sort `useMemo` with `useLibraryFilters({ keyPrefix: "lists", items: lists, sortFns: {...}, defaultSort: "created-desc", getTitle: (l) => l.name })`.
- [x] 3.2 Keep sessionStorage key names unchanged (`lists_search`, `lists_sort`) so existing persisted filters survive the migration.
- [x] 3.3 Wire `FilterBar`'s `showClear`/`onClear` to the hook's `isDefault`/`resetFilters`.
- [x] 3.4 Verify via the app's Playwright method (per CLAUDE.md - Verification): search, each sort option, and Clear filters all behave identically to before.

## 4. Migrate `FollowingPage.tsx`

- [x] 4.1 Replace hand-rolled `search`/`sortKey` state + sessionStorage effects + filter/sort `useMemo` with `useLibraryFilters({ keyPrefix: "following", items: followed, sortFns: {...}, defaultSort: "name-asc", getTitle: (p) => p.name })`.
- [x] 4.2 Keep sessionStorage key names unchanged (`following_search`, `following_sort`).
- [x] 4.3 Wire `FilterBar`'s `showClear`/`onClear` to the hook's `isDefault`/`resetFilters`.
- [x] 4.4 Verify via Playwright: confirmed FollowingPage renders correctly post-migration (empty state on a throwaway account with no followed people — search/sort UI only renders once `followed.length > 0`, matching pre-migration behavior; not independently exercisable without seeding a followed person).

## 5. Migrate `ListDetailPage.tsx` onto `MediaGrid`

- [x] 5.1 Replace the page's own `Row`/`Col` card grid with `<MediaGrid items={filteredItems} colSpan={{ md: 4 }} keyFn={...} renderCard={...} />`, wrapping the existing `LibraryItemCard` render in `renderCard`.
- [x] 5.2 Verify via Playwright at the tablet breakpoint (768-991px) that card density stays 6/row unchanged (unaffected pages) and 4/row unchanged (this page).

## 6. Documentation

- [x] 6.1 Update CLAUDE.md's "List-page filter bars" bullet: name `FilterBar` as the shared chrome layer used by all 6 pages, list `ListsPage`/`FollowingPage`/`ListDetailPage` as now on `useLibraryFilters`/`MediaGrid`, and document `RecommendationsPage` as a permanent non-fit (grouped sections, no sort control) rather than an open migration candidate.

## 7. Final verification

- [x] 7.1 Run `npx tsc --noEmit`.
- [x] 7.2 Run the existing e2e suite(s) covering Lists/Following/ListDetail pages; update any `page.route()` mocks or selectors only if the migration changed DOM structure in a way that breaks them (none expected — `FilterBar` markup is unchanged from the prior extraction). `e2e/python/test_lists.py` + `test_watchlist.py`: 35/35 passed, no changes needed. No dedicated TS spec exists for Lists/Following/ListDetail. Also ran a one-off Playwright script (per CLAUDE.md - Verification, deleted after use) confirming: ListsPage search/sort/Clear filters behave identically post-migration; sessionStorage key `lists_sort` unchanged; ListDetailPage's `MediaGrid` keeps `md=4` at the tablet breakpoint; WatchlistPage keeps the default `md=6`; FollowingPage renders its empty state without error.
