## 1. Build FilterBar

- [x] 1.1 Create `src/components/FilterBar.tsx`: a generic `FilterBar<TSort extends string>` default-exported component per design.md's Decisions — `search: {value, onChange, id, placeholder}` (hardcoded `prefix`, `allowClear`, `name="search"`, `autoComplete="off"`, `style={{ width: "100%", maxWidth: 200 }}`), optional `sort?: {value: TSort, onChange: (v: TSort) => void, options: {label: string, value: TSort}[], maxWidth?: number}` (default `maxWidth` 170), optional `typeFilter?: {value: LibraryTypeFilter, onChange: (v: LibraryTypeFilter) => void}` (hardcoded All Types/Movies/TV Shows options, `maxWidth: 130`), optional `extra?: ReactNode`, `showClear: boolean`, `onClear: () => void`. Render order: search → sort → typeFilter → extra → Clear button, wrapped in `<Space style={{ marginBottom: 16, flexWrap: "wrap" }}>`. Import `LibraryTypeFilter` from `../hooks/useLibraryFilters`.

## 2. Migrate each page

- [x] 2.1 `WatchlistPage.tsx`: replace the filter-bar `<Space>` block with `<FilterBar>`, passing `sort` (4 opts, maxWidth 170), `typeFilter`, `extra={<Select .../>}` (the existing `watchedFilter` Select unchanged), `showClear={!isDefault || watchedFilter !== "all"}`, `onClear={() => { resetFilters(); setWatchedFilter("all"); }}`
- [x] 2.2 `WatchedPage.tsx`: replace the filter-bar block with `<FilterBar>`, passing `sort` (4 opts incl. computed `my-rating-desc`, maxWidth 180), `typeFilter`, `extra={<InfoTooltip .../>}` (unchanged), `showClear={!isDefault}`, `onClear={() => { resetFilters(); setPageState(1, pageSize); }}`. Search/sort `onChange` keep their existing `setPageState(1, pageSize)` side effect.
- [x] 2.3 `ListDetailPage.tsx`: replace the filter-bar block with `<FilterBar>`, passing `sort` (4 opts, maxWidth 170), `typeFilter`, no `extra`, `showClear={!isDefault}`, `onClear={resetFilters}`
- [x] 2.4 `ListsPage.tsx`: replace the filter-bar block with `<FilterBar>`, passing `sort` (4 opts, maxWidth 180), no `typeFilter`, no `extra`, `showClear`/`onClear` from its existing local condition/handler
- [x] 2.5 `FollowingPage.tsx`: replace the filter-bar block with `<FilterBar>`, passing `sort` (2 opts, maxWidth 150), no `typeFilter`, no `extra`, `showClear`/`onClear` from its existing local condition/handler. Delete the now-redundant local `SortKey` type if `FilterBar`'s generic makes it inferable inline, otherwise keep it for the `useState<SortKey>` call.
- [x] 2.6 `RecommendationsPage.tsx`: replace the filter-bar block with `<FilterBar>`, passing no `sort`, `typeFilter`, no `extra`, `showClear`/`onClear` from its existing local `hasActiveFilters` condition/handler. Delete the now-redundant local `TypeFilter` type alias in favor of `LibraryTypeFilter`.

## 3. Verification

- [x] 3.1 `npx tsc --noEmit` — confirm the generic `FilterBar<TSort>` infers correctly at all 6 call sites with no type errors, and no unused-import errors from deleted local type aliases
- [x] 3.2 Manually verify via `npm run dev` + Playwright (per CLAUDE.md's Verification section, same method as the prior `ListDetailPage` migration): for each of the 6 pages, confirm the filter bar renders with the same controls/widths/options as before, search/sort/type-filter/reset all behave identically, and — for Watchlist/Watched specifically — the `extra` slot control (`watchedFilter` Select / `InfoTooltip`) still works and Clear-filters still resets it
