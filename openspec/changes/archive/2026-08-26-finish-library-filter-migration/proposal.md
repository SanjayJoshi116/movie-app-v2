## Why

CLAUDE.md's "List-page filter bars" convention names `ListsPage.tsx`,
`FollowingPage.tsx`, and `ListDetailPage.tsx` as pages that should reuse
`useLibraryFilters`/`MediaGrid` instead of hand-rolling the same search/sort
state and card-grid markup. A prior exploration (this session) found that
premise only half-holds:

- `ListDetailPage.tsx` was migrated onto `useLibraryFilters` in a separate
  change (`migrate-listdetail-library-filters`), but deliberately kept its
  own `Row`/`Col` instead of `MediaGrid`, because `MediaGrid` hardcodes
  `md=6` where this page's existing layout uses `md=4` — adopting it as-is
  would silently shrink the page's tablet card count from 6/row to 4/row.
- `ListsPage.tsx` and `FollowingPage.tsx` were never migrated onto
  `useLibraryFilters` at all: the hook's generic constraint requires
  `{ type: MediaType; title: string }`, and their items (`List`, followed
  `Person`) have neither field under those names.

Closer inspection shows both blockers are shallower than the constraint
suggests. Neither `ListsPage` nor `FollowingPage` renders a type-filter
control, so `.type` is never read at runtime for either — the constraint is
purely a static-typing artifact, not a real behavioral dependency. Their
search fields (`List.name`, `Person.name`) are semantically identical to
`.title`, just named differently. And `MediaGrid`'s column spans are already
one hardcoded default away from being configurable, following the same
"optional override, sensible default" shape the sibling `FilterBar.maxWidth`
prop already established in this codebase.

(`RecommendationsPage.tsx`, the fourth page CLAUDE.md's bullet named, stays
out of scope: it filters items across grouped sections rather than one flat
array and has no sort control at all, a structural mismatch — not a naming
one — that widening the hook's field accessors would not fix.)

## What Changes

- Add optional `getTitle`/`getType` accessor params to `useLibraryFilters`
  (`src/hooks/useLibraryFilters.ts`), defaulting to reading `.title`/`.type`
  directly — the exact behavior all three existing callers
  (`WatchlistPage`, `WatchedPage`, `ListDetailPage`) already get today, so
  none of their call sites change.
- Migrate `ListsPage.tsx` onto `useLibraryFilters` (`getTitle: (l) =>
  l.name`, no `getType`, no type-filter UI), replacing its hand-rolled
  `search`/`sortKey` state, sessionStorage effects, and filter/sort
  `useMemo`.
- Migrate `FollowingPage.tsx` onto `useLibraryFilters` (`getTitle: (p) =>
  p.name`, no `getType`) the same way.
- Add an optional `colSpan?: { xs, sm, md, lg }` prop to `MediaGrid`
  (`src/components/MediaGrid.tsx`), defaulting to today's `{xs:12, sm:8,
  md:6, lg:4}` — `WatchlistPage`/`WatchedPage` keep the default unchanged.
- Migrate `ListDetailPage.tsx`'s remaining hand-rolled `Row`/`Col` onto
  `MediaGrid` with `colSpan={{ md: 4 }}`, matching its current layout
  exactly.
- Update CLAUDE.md's "List-page filter bars" bullet to reflect the new
  state: `ListsPage`/`FollowingPage`/`ListDetailPage` on the shared hook and
  grid, `RecommendationsPage` documented as a permanent non-fit (grouped
  sections, no sort) rather than a lingering migration candidate.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — this is an internal DRY refactor with no change to any page's
documented external behavior: identical search/sort/filter results,
identical sessionStorage key names and persisted values, identical grid
layout and breakpoints on every affected page. This change sets
`skip_specs: true` in `.openspec.yaml`.)

## Impact

- Modified: `src/hooks/useLibraryFilters.ts`, `src/components/MediaGrid.tsx`,
  `src/pages/ListsPage.tsx`, `src/pages/FollowingPage.tsx`,
  `src/pages/ListDetailPage.tsx`, `CLAUDE.md`
- No changes to `WatchlistPage.tsx`, `WatchedPage.tsx`, or
  `RecommendationsPage.tsx` — the first two keep default hook/grid behavior
  unchanged, the third is explicitly out of scope (see Why).
- No API, routing, or data-layer changes.
