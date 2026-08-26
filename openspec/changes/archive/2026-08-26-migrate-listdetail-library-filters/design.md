## Context

See proposal.md - Why. `ListDetailPage.tsx` currently owns three
`useState`s (`search`, `sortKey`, `typeFilter`), three `useEffect`s that
mirror each into sessionStorage under `listdetail_search`,
`listdetail_sort`, `listdetail_type_filter`, and a `useMemo` that filters
`list.items` by type/search then sorts via a `switch` on `sortKey`. This
is the exact shape `useLibraryFilters` (`src/hooks/useLibraryFilters.ts`)
already abstracts for `WatchlistPage`/`WatchedPage`.

## Goals / Non-Goals

**Goals:**
- Replace the page's local state/effects/memo with one
  `useLibraryFilters` call, preserving current behavior exactly.
- Keep the persisted sessionStorage keys unchanged so no user's saved
  filter/sort/search state resets on upgrade.

**Non-Goals:**
- Not touching the page's grid rendering (`Row`/`Col` breakpoints) or
  swapping in `MediaGrid` — see proposal.md's What Changes for why
  (`MediaGrid`'s hardcoded `md=6` would shrink this page's tablet card
  count from 6/row to 4/row, a visible change out of scope here).
- Not generalizing `useLibraryFilters` to support non-media collections
  (`ListsPage`'s `List` objects, `FollowingPage`'s `Person` objects) —
  those lack a `.type: MediaType` field the hook's generic requires, and
  fixing that is a separate design question.
- Not touching `RecommendationsPage.tsx` — section-grouped rendering
  with no sort control, a different shape entirely.

## Decisions

- **Adopt `useLibraryFilters` as-is; do not modify the hook.**
  `list.items` is typed `WatchlistEntry[]` (`{id, type: MediaType,
  title, posterPath, voteAverage, addedAt}`), which already satisfies
  the hook's `LibraryItem` constraint (`{type: MediaType; title:
  string}`) — the same shape Watchlist/Watched pass in. No hook changes
  needed for this one page.
- **`keyPrefix: "listdetail"`.** This reproduces the page's existing
  sessionStorage keys (`listdetail_search`, `listdetail_sort`,
  `listdetail_type_filter`) exactly, per the hook's
  `${keyPrefix}_search`/`_sort`/`_type_filter` convention — a user's
  already-persisted filter state survives the refactor unchanged.
- **`sortFns` map 1:1 from the current `switch`:**
  - `"added-desc"` (default): `(a, b) => b.addedAt.localeCompare(a.addedAt)`
  - `"added-asc"`: `(a, b) => a.addedAt.localeCompare(b.addedAt)`
  - `"title-asc"`: `(a, b) => a.title.localeCompare(b.title)`
  - `"rating-desc"`: `(a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0)`
- **No `extraFilter`.** Unlike Watchlist's watched-status filter,
  ListDetailPage has no secondary predicate beyond type + search.
- **`isDefault` replaces the page's inline "show Clear filters" check.**
  The current condition (`search.trim() !== "" || typeFilter !== "all"
  || sortKey !== "added-desc"`) is exactly `!isDefault` from the hook —
  swap the JSX condition, no behavior change.
- **`resetFilters` replaces the inline Clear-filters handler.** The
  hook's reset (search → `""`, sortKey → `defaultSort`, typeFilter →
  `"all"`) matches the page's current handler exactly.
- **The hook is called unconditionally, before the page's early
  returns.** `ListDetailPage` returns early for `isLoading` and `!list`
  (list not found) *after* its current `useMemo` runs — the existing
  code already respects React's rules-of-hooks ordering. Calling
  `useLibraryFilters({ items: list?.items ?? [], ... })` at the same
  point preserves that ordering; no restructuring of the early returns
  needed.

## Risks / Trade-offs

- [None specific to this change.] The hook is already exercised by two
  other pages with the same item shape; this is a mechanical swap with
  no behavior change, verified by the page's existing filter/sort/
  reset semantics mapping 1:1 onto the hook's return values.
