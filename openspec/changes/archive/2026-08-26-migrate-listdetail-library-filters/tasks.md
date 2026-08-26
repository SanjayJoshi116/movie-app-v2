## 1. Adopt useLibraryFilters

- [x] 1.1 In `src/pages/ListDetailPage.tsx`, import `useLibraryFilters` from `../hooks/useLibraryFilters` and remove the local `SS_SEARCH`/`SS_SORT`/`SS_TYPE_FILTER` constants, the three `useState`s (`search`, `sortKey`, `typeFilter`), the three sessionStorage `useEffect`s, and the `filteredItems` `useMemo`
- [x] 1.2 Call `useLibraryFilters<WatchlistEntry>({ keyPrefix: "listdetail", items: list?.items ?? [], sortFns: {...}, defaultSort: "added-desc" })` with the four `sortFns` entries from design.md's Decisions (`added-desc`, `added-asc`, `title-asc`, `rating-desc`), placed at the same point in the component (before the `isLoading`/`!list` early returns) so hook-call ordering is unchanged
- [x] 1.3 Replace remaining local references: `search`/`setSearch` → hook's `search`/`setSearch`, `sortKey`/`setSortKey` → hook's `sortKey`/`setSortKey`, `typeFilter`/`setTypeFilter` → hook's `typeFilter`/`setTypeFilter`, `filteredItems` → hook's `filtered`
- [x] 1.4 Replace the inline "show Clear filters" condition (`search.trim() !== "" || typeFilter !== "all" || sortKey !== "added-desc"`) with `!isDefault`, and the inline Clear-filters `onClick` handler with the hook's `resetFilters`
- [x] 1.5 Leave the `Row`/`Col` grid JSX and its breakpoints (`xs=12 sm=8 md=4 lg=4`) untouched — do not introduce `MediaGrid`

## 2. Verification

- [x] 2.1 `npx tsc --noEmit` — confirm no type errors from the `WatchlistEntry` generic or the removed local state
- [x] 2.2 Manually verify via `npm run dev` + Playwright (per CLAUDE.md's Verification section): open a list with items, confirm search/sort/type-filter/reset all behave identically to before, and that sessionStorage keys `listdetail_search`/`listdetail_sort`/`listdetail_type_filter` are still the ones written (e.g. an old persisted value from before this change still applies after upgrade)
