## Context

`useLibraryFilters<T extends LibraryItem>` (`src/hooks/useLibraryFilters.ts`)
currently requires `T` to have `type: MediaType` and `title: string`, and
unconditionally filters on `.type` whenever `typeFilter !== "all"`. Its three
current callers (`WatchlistPage`, `WatchedPage`, `ListDetailPage`) all operate
on `WatchlistEntry`-shaped items that satisfy this directly.

`MediaGrid<T>` (`src/components/MediaGrid.tsx`) renders a fixed `Row`/`Col`
grid with hardcoded breakpoints (`xs=12 sm=8 md=6 lg=4`). `ListDetailPage`
needs `md=4` to preserve its current 6-cards-per-tablet-row density and so
still renders its own `Row`/`Col` instead of using it.

See `proposal.md` - Why for the full motivation.

## Goals / Non-Goals

**Goals:**
- Let `ListsPage`/`FollowingPage` reuse `useLibraryFilters` for search+sort
  state and sessionStorage persistence without changing their current
  filter/sort results or key names.
- Let `ListDetailPage` reuse `MediaGrid` for its card grid without changing
  its current breakpoints.
- Preserve byte-for-byte behavior on every existing caller of both — this is
  a pure widening, not a rewrite.

**Non-Goals:**
- Do not migrate `RecommendationsPage` onto `useLibraryFilters` (see
  proposal.md - Why: grouped-sections shape and missing sort control are a
  structural mismatch, not a naming one).
- Do not add a type-filter UI to `ListsPage`/`FollowingPage` — they have no
  movie/tv distinction to filter on; `getType` stays unset for both.
- Do not generalize `MediaGrid` beyond column spans (e.g. gutter, card
  aspect ratio) — nothing in scope needs it.

## Decisions

**Accessor params over a second generic constraint.** Rather than loosening
`LibraryItem` to `{ type?: MediaType; title?: string }` and hoping structural
typing lines up, add explicit optional functions:

```ts
interface Options<T> {
  ...
  getTitle?: (item: T) => string;   // default: (item as any as { title: string }).title
  getType?: (item: T) => MediaType; // omit entirely -> type-filter is a no-op
}
```

This makes each page's field mapping explicit at the call site (`getTitle:
(l) => l.name`) instead of relying on a loosened structural type that would
silently accept any object with an optional `title`. It also drops the `T
extends LibraryItem` constraint entirely — `T` becomes unconstrained,
since every field access now goes through an accessor with a default.

**`getType` presence, not a boolean flag, gates the type filter.** Internal
filtering becomes `if (getType && typeFilter !== "all") { ... }`. Pages that
omit `getType` keep `typeFilter` state wired up internally (harmless, since
its own UI is never rendered without a `typeFilter` prop on `FilterBar`) but
it never affects `filtered`. Considered a separate `enableTypeFilter:
boolean` param instead — rejected as redundant: whether a page can type-filter
is exactly whether it can produce a `MediaType` per item, which `getType`
already encodes.

**Defaults preserve today's three call sites exactly.** `getTitle`
defaulting to reading `.title` and `getType` defaulting to reading `.type`
means `WatchlistPage`/`WatchedPage`/`ListDetailPage` need zero changes to
their existing `useLibraryFilters` calls — this is additive-only from their
perspective.

**`colSpan` as a full override object, not per-breakpoint props.** `MediaGrid`
takes `colSpan?: { xs?: number; sm?: number; md?: number; lg?: number }`,
merged over `{ xs: 12, sm: 8, md: 6, lg: 4 }`, rather than four separate
optional props (`colSpanMd?`, etc.) or a required full object. Callers that
only need to override one breakpoint (`ListDetailPage`'s `{ md: 4 }`) stay
minimal; `WatchlistPage`/`WatchedPage` pass nothing and get today's exact
values.

## Risks / Trade-offs

- [Widening `useLibraryFilters`'s signature touches a hook shared by 3
  already-shipped pages] → Both new params are optional with defaults that
  reproduce current behavior exactly; no existing call site changes. Verify
  with the app's Playwright method (per CLAUDE.md - Verification) on
  Watchlist/Watched/ListDetail after the change, not just the two new pages.
- [`MediaGrid`'s `colSpan` merge could be implemented wrong and silently
  change Watchlist/Watched's layout] → Default the merge so an absent
  `colSpan` prop produces object-identical values to the current hardcoded
  props; spot-check Watchlist/Watched at the tablet breakpoint (768-991px)
  after the change.
- [`ListsPage`/`FollowingPage` currently have no `isDefault`/`resetFilters`
  bugs because their logic is inline and simple] → Migrating onto the shared
  hook trades a small chance of a subtle regression (e.g. clear-filters
  condition) for eliminating the duplicated boilerplate; mitigate by keeping
  each page's sessionStorage key names (`lists_search`/`lists_sort`,
  `following_search`/`following_sort`) unchanged so persisted user state
  survives the migration.

## Migration Plan

1. Widen `useLibraryFilters` (additive params) — no page changes yet, so
   this step alone should be a no-op for the app.
2. Widen `MediaGrid` (`colSpan` prop, defaulted) — same, no-op alone.
3. Migrate `ListsPage`, then `FollowingPage`, onto the hook — each is an
   independent, single-page change; verify one before starting the next.
4. Migrate `ListDetailPage`'s grid onto `MediaGrid` with `colSpan={{ md: 4
   }}`.
5. Update CLAUDE.md's "List-page filter bars" bullet last, once the code
   matches what it will describe.

No feature flag or rollback mechanism needed — each step is independently
revertable via normal source control, and no persisted data format changes.
