## Why

Six pages (`WatchlistPage.tsx`, `WatchedPage.tsx`, `ListDetailPage.tsx`,
`ListsPage.tsx`, `FollowingPage.tsx`, `RecommendationsPage.tsx`) each
render their own copy of the same filter-bar chrome: a search `Input`,
an optional sort `Select`, an optional type-filter `Select`, and a
conditional "Clear filters" `Button`, all wrapped in an identical
`<Space style={{ marginBottom: 16, flexWrap: "wrap" }}>`. This is
~25-30 lines of near-identical JSX duplicated six times — real
presentational duplication, independent of the fact (established in a
prior exploration) that the six pages' underlying *filtering logic*
genuinely differs too much to unify behind one data hook.

Because this duplication is purely visual chrome, not filtering
behavior, it can be extracted without touching any page's state
management — each page already computes its own `search`/`sortKey`/
`typeFilter` values and `isDefault`/reset logic (via `useLibraryFilters`
on 3 pages, local `useState` on the other 3); a shared component just
needs to render what each page hands it.

## What Changes

- Add a new `FilterBar` component (`src/components/FilterBar.tsx`)
  that renders the search `Input` (always), an optional sort `Select`,
  an optional type-filter `Select`, an optional `extra` slot for a
  page-specific control, and a conditional "Clear filters" `Button` —
  matching the current markup (same widths, same `id`/`autoComplete`
  convention, same option shapes) exactly.
- Replace the hand-rolled `<Space>...</Space>` filter-bar block in all
  6 pages with a single `<FilterBar ... />` call, passing each page's
  existing state/handlers as props. No page's filtering/sorting logic
  changes.
- `WatchlistPage.tsx`'s fourth `Select` (`watchedFilter`) and
  `WatchedPage.tsx`'s `InfoTooltip` move into the new `extra` slot.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — this is a presentational-only extraction with no change to
any page's documented external behavior: identical search/sort/filter
options, identical Clear-filters conditions, identical layout. This
change sets `skip_specs: true` in `.openspec.yaml`.)

## Impact

- New: `src/components/FilterBar.tsx`
- Modified: `src/pages/WatchlistPage.tsx`, `src/pages/WatchedPage.tsx`,
  `src/pages/ListDetailPage.tsx`, `src/pages/ListsPage.tsx`,
  `src/pages/FollowingPage.tsx`, `src/pages/RecommendationsPage.tsx`
- No API, routing, or data-layer changes.
