## Why

`CLAUDE.md`'s "List-page filter bars" convention names `useLibraryFilters`
(`src/hooks/useLibraryFilters.ts`) as the shared search/sort/type-filter
hook `WatchlistPage`/`WatchedPage` already use, and calls out
`RecommendationsPage.tsx`, `ListsPage.tsx`, `ListDetailPage.tsx`, and
`FollowingPage.tsx` as pages that "still each hand-roll the same shape
locally" and are candidates to migrate.

A closer look (see prior exploration in this project) shows those four
aren't actually interchangeable candidates: `ListsPage` and
`FollowingPage` filter/sort objects (`List`, `Person`) that have no
`.type: MediaType` field, so they don't satisfy the hook's generic
constraint without relaxing it — a separate, larger design question.
`RecommendationsPage` renders section-grouped data with no sort control
at all, a fundamentally different shape than what the hook or
`MediaGrid` support.

`ListDetailPage.tsx` is the one genuine 1:1 fit: its items are typed
`WatchlistEntry[]` (`{id, type: MediaType, title, posterPath,
voteAverage, addedAt}`) — the exact same shape Watchlist/Watched already
run through this hook — and its existing sessionStorage keys
(`listdetail_search`, `listdetail_sort`, `listdetail_type_filter`)
already match the hook's `${keyPrefix}_*` convention exactly. This
change closes that one gap now, and leaves the other three as a
separate, explicitly out-of-scope decision.

## What Changes

- Replace `ListDetailPage.tsx`'s hand-rolled `search`/`sortKey`/`typeFilter`
  state (3 `useState` + 3 `useEffect` for sessionStorage persistence + 1
  `useMemo` filter/sort pipeline + inline "Clear filters" condition) with
  a single `useLibraryFilters` call, matching the pattern already used by
  `WatchlistPage.tsx`/`WatchedPage.tsx`.
- No change to the page's grid rendering: the existing inline `Row`/`Col`
  layout and its breakpoints (`xs=12 sm=8 md=4 lg=4`) stay exactly as-is.
  `MediaGrid` (the other half of the shared pattern) hardcodes `md=6`,
  which would silently shrink this page's tablet card count from 6/row
  to 4/row — a real visual change, deliberately excluded from this change's
  scope.
- No change to sessionStorage key names, default sort, filter semantics,
  or any user-visible behavior.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — this is an internal state-management refactor with no change to
the page's documented external behavior: same filters, same default
sort, same persisted sessionStorage keys, same grid layout. This change
sets `skip_specs: true` in `.openspec.yaml`.)

## Impact

- `src/pages/ListDetailPage.tsx`
- No changes to `src/hooks/useLibraryFilters.ts`, `ListsPage.tsx`,
  `FollowingPage.tsx`, or `RecommendationsPage.tsx` — those are
  explicitly out of scope (see Why).
