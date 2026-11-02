## 1. Browse genres and Anime mode

- [x] 1.1 Move applied genres into `App`: add `activeGenres` state, and reset it in the render-time scope-change and sign-out blocks with `activeFilters`/`activeSortBy`. Remove `App`'s `clearGenres` effect.
- [x] 1.2 `FilterPanel`: take `appliedGenres` and seed draft genres from it (through `genresFor`). `onApply(filters, sortBy, genres)` sends them, and `onReset` clears them through `App`. Remove the `useAppContext` genre reads.
- [x] 1.3 Remove `selectedGenres`, `toggleGenre`, `setGenres`, `clearGenres` and the sign-out genre reset from `UIContext`, `src/types/context.ts` and `useAppContext`. Fix every reader that typecheck reports.
- [x] 1.4 `HomePage` and `AnimePage`: take an `externalGenres` prop, and remove the mount-effect `clearGenres()` and the Anime toggle's `clearGenres()`.
- [x] 1.5 `AnimePage`: take `initialMode` from `App`'s `animeMediaType`. A non-return visit starts in that mode with `defaultAnimeCategory(initialMode)`.
- [x] 1.6 Tests:
  - A same-scope revisit sends one request carrying both the genres and the filters.
  - A scope change sends one request with no `with_genres`.
  - Reopening Anime after Movies mode sends one movie discover request.
  - Sign-out clears genres.
  - Update the Jest/e2e tests that mocked `selectedGenres`.

## 2. Explicit watched/watchlist writes

- [x] 2.1 `RecommendationsPage`'s `RecCard`: use `useWatchedContext().add/remove` and `useWatchlistContext().add/remove`, chosen from the state the user clicked on. The Mark-watched confirm always calls `add`. Toasts name the action that ran.
- [x] 2.2 `WatchlistPage`: the Mark-watched confirm calls `add`, and Unmark calls `remove`.
- [x] 2.3 Tests: a title that becomes watched while the dialog is open stays watched on confirm. A stale "Add to watchlist" click never removes the title.

## 3. Dialogs and forms

- [x] 3.1 `ListsPage` Create List and `ListDetailPage` Edit List: while busy, set `closable={false}`, `maskClosable={false}`, `keyboard={false}`, disable Cancel, and make `onCancel` a no-op. Reset the fields only after a success or a real cancel.
- [x] 3.2 `ResetPasswordPage` and `ForgotPasswordPage`: add a `useRef` submit guard, set before the `await` and cleared in `finally`.
- [x] 3.3 Tests: Escape during create keeps the dialog and its input. A double submit on each password form sends one request.

## 4. Page robustness

- [x] 4.1 `PeoplePage`: sync `inputValue` to `searchTerm` when `?q=` changes. Test: `/people?q=nolan` → navigate to `/people` → the field is empty.
- [x] 4.2 `PersonPage`: shape-guard the images answer (`objectOr` + `arrayOr(profiles)`, and keep only entries with a string `file_path`). Test: `{}` and `{"profiles": null}` render the page without Photos.
- [x] 4.3 `ListDetailPage`: title "List not found" / "Couldn't load your lists" by state. Test both.

## 5. Library pagination, filters, performance

- [x] 5.1 `useWatchlist`: expose `hasLoaded` (a successful load this session, kept after a failed reload), mirroring `useWatched`, through `WatchlistContext`.
- [x] 5.2 `WatchedPage` and `WatchlistPage` clamps: gate on `!isLoading && hasLoaded` instead of `!loadError`. Keep the Watchlist's watched-filter gates. Tests: removing the last item on the last page after a failed reload moves back a page.
- [x] 5.3 Memoize `WatchedPage`'s `sortFns` (`useMemo` on `getRating`) and `WatchlistPage`'s `extraFilter` (`useCallback` on `watchedFilter`, `isWatched`).
- [x] 5.4 Validate restored values with `pickKey`: the Watchlist watched filter, and `useLibraryFilters`' type filter and sort key. Test an unknown stored value.
- [x] 5.5 `CalendarPage`: fetch movies and TV in parallel for "All", keeping the superseded-response drop.

## 6. Docs and checks

- [x] 6.1 Update CLAUDE.md:
  - The "Browse filters and Back restore" and "Adult content toggle" bullets: genres live in `App` with the applied filters, not `UIContext.setGenres`, and are kept on a same-scope revisit.
  - The Anime toggle note.
  - Add a `docs/ARCHITECTURE.md` bullet if the genre move needs its rationale recorded.
- [x] 6.2 Run `npm run typecheck`, `npm run lint` and the full Jest suite, plus the touched e2e specs (browse filters, lists, people, auth pages, recommendations, watchlist).
- [x] 6.3 Mark backlog item 58 in `docs/BUG_BACKLOG.md` with the change name and status.
