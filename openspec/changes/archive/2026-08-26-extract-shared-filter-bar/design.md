## Context

See proposal.md - Why. Six pages each render a `<Space style={{
marginBottom: 16, flexWrap: "wrap" }}>` containing: a search `Input`
(always), a sort `Select` (5/6 pages — absent on `RecommendationsPage`),
a type-filter `Select` (4/6 pages — absent on `ListsPage`/
`FollowingPage`, whose items have no media type), an optional
page-specific control, and a conditional "Clear filters" `Button`.
Exact current shape per page (from direct reading of all 6 files):

| Page | search id | sort (maxWidth) | typeFilter | extra slot content |
|---|---|---|---|---|
| Watchlist | `watchlist-search` | 4 opts (170) | yes | `watchedFilter` Select (150) |
| Watched | `watched-search` | 4 opts incl. computed `my-rating-desc` (180) | yes | `InfoTooltip` |
| ListDetail | `list-detail-search` | 4 opts (170) | yes | — |
| Lists | `lists-search` | 4 opts (180) | — | — |
| Following | `following-search` | 2 opts (150) | — | — |
| Recommendations | `recommendations-search` | — | yes | — |

The search `Input` itself (`prefix={<SearchOutlined />}`, `allowClear`,
`style={{ width: "100%", maxWidth: 200 }}`, `name="search"`,
`autoComplete="off"`) and the type-filter `Select`'s three options
(`All Types`/`Movies`/`TV Shows`, `maxWidth: 130`) are byte-for-byte
identical everywhere they appear — only `id`/`placeholder` (search) and
`value`/`onChange` (type-filter) vary per page.

## Goals / Non-Goals

**Goals:**
- One `FilterBar` component rendering this chrome, dropped into all 6
  pages in place of their local `<Space>` block, with no visual change.
- No change to any page's filtering/sorting state or logic — `FilterBar`
  receives already-computed values/handlers as props and renders; it
  does not compute `isDefault`, filter arrays, or own any state.

**Non-Goals:**
- Not unifying the 6 pages' underlying filter *state* (that's the
  separate, larger "generalize `useLibraryFilters`" question raised in
  the same exploration this proposal came from, and explicitly out of
  scope here).
- Not changing any option list, width, label, or Clear-filters
  condition — this must look pixel-identical to today.

## Decisions

- **`FilterBar` owns the `<Space>` wrapper entirely.** Pages keep their
  existing outer conditional (e.g. `{watchlist.length > 0 && (...)}`)
  around the `<FilterBar />` call, but the `Space`/`marginBottom`/
  `flexWrap` styling moves inside the component — one place to change
  the bar's own layout instead of six.
- **Fixed slot order: search → sort? → typeFilter? → extra? → Clear
  button?** — matches every page's current markup exactly (verified in
  Context table; `extra` always sits between `typeFilter` and the Clear
  button in both pages that use it).
- **Type-filter is a first-class prop (`typeFilter?: {value, onChange}`),
  not part of the generic `sort` shape, and its three options are
  hardcoded inside `FilterBar`** rather than passed in — every instance
  of this Select is identical, so passing the same 3-item options array
  from 4 call sites would just be more duplication moved one level up.
  Import the existing `LibraryTypeFilter` type (`"all" | "movie" |
  "tv"`, from `src/hooks/useLibraryFilters.ts`) for this prop's type
  rather than redeclaring an equivalent union — `RecommendationsPage`/
  `FollowingPage` already declare their own structurally-identical
  local `TypeFilter` alias for this today; those local aliases can be
  deleted once they route through `FilterBar`.
- **`sort` is generic (`FilterBar<TSort extends string>`), not typed to
  a fixed union.** Sort value types differ genuinely per page (e.g.
  Following's `"name-asc" | "name-desc"` vs Watchlist's 4-way sort
  union) and callers pass their existing `setSortKey` directly as
  `onChange`. Under this repo's `strict`/`strictFunctionTypes` TS
  config, a non-generic `onChange: (v: string) => void` prop would
  reject a narrower callback like `Dispatch<SetStateAction<"name-asc" |
  "name-desc">>` (contravariant parameter mismatch) — making the
  component generic over the sort-key type lets each call site's own
  literal union flow through untouched, options included (`options:
  {label: string; value: TSort}[]`), with `maxWidth?: number` (default
  `170`, the most common current value; pages needing 150/180 pass it
  explicitly — see Context table for which).
- **`extra?: ReactNode`** is a raw slot, not a further-parameterized
  API. `Watchlist`'s `watchedFilter` `Select` and `Watched`'s
  `InfoTooltip` are structurally unrelated to each other; forcing them
  into a shared shape (e.g. "extra select" vs "extra tooltip" props)
  would add complexity `FilterBar` doesn't need. The page keeps
  authoring that one control's JSX and hands it in as-is.
- **`showClear: boolean` and `onClear: () => void` are resolved by the
  caller, not computed by `FilterBar`.** Most pages' condition is just
  `!isDefault` and handler just `resetFilters`, but `WatchlistPage`'s
  condition is `!isDefault || watchedFilter !== "all"` and its handler
  must also `setWatchedFilter("all")`; `WatchedPage`'s handler must
  also call `setPageState(1, pageSize)` to reset URL-encoded pagination.
  `FilterBar` has no way to know about a page's extra state, so it only
  renders the button when told to and calls whatever it's given.
- **Default export**, matching this codebase's convention for
  components (`MediaGrid`, `LibraryItemCard`) vs. hooks (named exports).

## Risks / Trade-offs

- [A generic component with 3 optional slots plus a raw `extra` prop is
  a wider surface than a single-shape component.] → Every prop here
  maps to something in the Context table's per-page markup that
  genuinely differs; the alternative (six copies of ~28 similar lines)
  is what's being removed. If a *seventh* page needs yet another
  one-off control beyond `extra`, that's a signal to reconsider the
  API then, not to over-generalize now.
- [Visual regression if a per-page width/option is transcribed
  incorrectly during extraction.] → Mitigated by the Context table
  above (copied directly from each page's current JSX) and by
  Playwright verification per page in tasks.md, same method used for
  the `ListDetailPage` migration in the prior change.
