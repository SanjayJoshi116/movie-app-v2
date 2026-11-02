## Context

Backlog item 58: all ten findings were checked against the code and confirmed. The fixes are frontend only. Most are local to one page. One is structural: applied genres live in `UIContext`, a parent provider, so `App` can't reset them during render the way it resets the applied filters and sort (`App.tsx:58`). Today they are reset in effects instead: `App`'s scope effect, plus the mount effects in `HomePage` and `AnimePage`. Effects run after the page's first request, so a stale `with_genres` request always goes out first. CLAUDE.md names this exact pattern as a bug.

## Goals / Non-Goals

**Goals:**
- The first grid request on Movies, TV and Anime uses the values the page shows, so no request is sent and then replaced.
- Watched/watchlist writes run the action shown, from every page.
- List dialogs and the reset forms follow the write-feedback rules the rest of the app already follows.
- Small robustness and efficiency gaps found by the same review are closed.

**Non-Goals:**
- Paginating list detail (it renders up to 2,000 cards).
- Merging `RecCard` into `MediaCard`, moving `SectionRow` out of `RecommendationsPage`, de-duplicating Home/Anime restore code, memoizing the Stats heatmap. These are logged in item 58 for later.

## Decisions

1. **Applied genres move into `App`, next to the applied filters.**
   - `App` holds `activeGenres` and resets it in the same render-time block as `activeFilters`/`activeSortBy`: on a scope change and on sign-out.
   - `FilterPanel` takes `appliedGenres`, and `onApply(filters, sortBy, genres)` sends the genres with the rest. `onReset` clears them through `App`.
   - Pages take an `externalGenres` prop and still pass it through `genresFor()`.
   - From `UIContext` and its types, remove `selectedGenres`, `toggleGenre`, `setGenres` and `clearGenres`, the sign-out genre reset, and `App`'s `clearGenres` effect.
   - Remove the mount-effect `clearGenres()` in Home and Anime, and the Anime toggle's `clearGenres()` (the scope change now resets genres during render).
   - *Alternative:* tag genres with their scope inside `UIContext`, and have pages ignore them under another scope. That still leaves two homes for one piece of applied state, plus a lazy clear. Rejected.
   - *Behaviour change:* a normal (non-Back) revisit of the same scope now keeps genres, as it already kept the filters. The old page effect dropped only the genres, which was inconsistent and cost a request.
2. **Anime opens in the remembered mode.**
   - `App` passes `animeMediaType` to `AnimePage` as `initialMode`.
   - Without a Back restore, `animeTab` starts at `initialMode`, and `activeCategory` at `defaultAnimeCategory(initialMode)`. A restore still derives the mode from the saved category.
   - The mount-time `onMediaTypeChange(animeTab)` stays, for a Back restore whose saved mode differs from `App`'s. In practice that can't happen after this change: `App` remembers the last mode used, which is the mode the restore saved. If it ever did differ, it would behave as today: one extra request after the scope reset.
   - *Alternative:* reset `animeMediaType` to TV whenever Anime is entered without a restore, which would drop the Movies-mode filters. Rejected: it loses the user's filters, and "kept on a same-scope revisit" is the rule everywhere else.
3. **Explicit writes.** `RecCard` and `WatchlistPage` use `useWatchedContext().add/remove` and `useWatchlistContext().add/remove`, chosen from the state shown when the user clicked (or, for the dialog, opened it), the same way `MediaCard` does. Toasts name that action.
4. **List dialogs hold.** While `creating`/`saving`: `closable={false}`, `maskClosable={false}`, `keyboard={false}`, and the Cancel button disabled (`cancelButtonProps`). `onCancel` returns early while busy, and `resetFields()` runs only after a successful create or a real cancel.
5. **Reset and Forgot submit once** through a `useRef` guard set before the `await` and cleared in `finally`, as `RegisterPage` does.
6. **People input sync.** When `searchTerm` (from `?q=`) changes, an effect sets `inputValue` to it. That is the same rule as `SearchBox`'s "shows the term in effect whenever it changes from outside typing". Typing doesn't change `searchTerm` until submit, so the effect never fights the user's keystrokes.
7. **Person photos.** `objectOr` on the images answer, then `arrayOr(profiles)` filtered to entries whose `file_path` is a string. Same guards as `src/utils/appended.ts`.
8. **Library pagination clamp.**
   - Watched: gate on `!isLoading && hasLoaded` instead of `!isLoading && !loadError`. `useWatched` already exposes `hasLoaded`, which stays true after a failed reload that kept the list.
   - Watchlist: needs the same signal from `useWatchlist`. Add `hasLoaded` there if it isn't exposed yet, mirroring `useWatched`. The watched-filter gates (`filterReady`/`filterSettled`) stay as they are.
9. **Memoization.** `sortFns` in `useMemo` keyed on `getRating`, and `extraFilter` in `useCallback` keyed on `watchedFilter` and `isWatched`.
10. **Folds:**
    - Calendar "All" runs its movie and TV requests with `Promise.all`, keeping the request-id drop.
    - `ListDetailPage` titles: `list?.name`; else "Couldn't load your lists" on error, "List not found" once loaded without it, "List" while loading.
    - Saved filter values go through `pickKey` against the control's choices: Watchlist watched filter, and `useLibraryFilters`' type filter and sort key.

## Risks / Trade-offs

- **Removing genres from `UIContext` touches several files at once:** `FilterPanel`, `App`, both browse pages, the context type, and tests that mock `useAppContext` with `selectedGenres`. Typecheck finds every reader.
- **Keeping genres on a same-scope revisit is a visible behaviour change.** It matches the spec's existing promise for filters and is noted in the CHANGELOG.
- **Anime restore edge:** a Back restore whose saved mode differs from `App`'s remembered mode would still report the mode in an effect, as today. After this change it shouldn't occur.
