## Why

The fifth audit's frontend pages pass (backlog item 32) found screens that still say something untrue: a failed load reads as "nothing here", a Cancel in the Lists page's Delete confirm opens the list, a connected TMDB account is offered "Connect", and a bad `?page` shows the wrong slice. It also found filter-drawer and Add to List controls with no accessible names, and a handful of theme and convention leftovers. They break the `load-states`, `accessibility` and `browse-filters` contracts already in place, so they go in one pass now, before the remaining backend items (29, 28) and infra (34).

## What Changes

- **Lists page Delete confirm**: neither OK nor Cancel opens the list. The confirm's clicks no longer bubble to the card's `onClick`. The e2e test that should have caught it (`test_lists.py`) asserts that the DELETE was sent and that no navigation happened.
- **Failures are never shown as empty**:
  - For You shows `LoadError` when the watched library failed to load, not "No watched titles yet".
  - For You shows an inline error with Retry when one group fails after others loaded, and a followed-people failure no longer hides the "Crunching…" state of the groups still computing.
  - Person page: failed credit requests show an error with Retry in the credits area, not "No credits available".
  - Reset password, forgot password and register take their error text only from `getApiError` (a 502 or network failure no longer reads "Invalid or expired reset link", no "Make sure the backend is running", no `[object Object]`).
  - Lists page keeps its grid during a background reload. The spinner is only for the first load.
- **Honest UI state**:
  - Watched page validates `?page` (integer ≥ 1) and `?pageSize` (one of 12/24/48/96), falling back to the defaults.
  - People page shows an empty state when a search has no matches.
  - Profile's TMDB section shows a loading state until the status check answers, instead of starting at "not connected".
  - Movies/TV/Anime category buttons are disabled while a search or filters are active (they had no effect but resent the same request).
  - The Anime TV/Movies toggle sets the matching category in its own handler, so a switch sends one grid request with the new mode's params.
  - An unknown `?tab=` on Stats and Search falls back to the default tab instead of a blank panel.
- **Accessibility**:
  - The filter drawer's "Include Adult Content" switch becomes part of the draft (applies on Apply, like every other drawer control) and gets an accessible name.
  - The drawer's Year/Rating/Runtime/Language/Sort inputs are linked to their labels.
  - Add to List rows are a named checkbox per list, not a clickable `div` with an unnamed checkbox.
  - The phone Search drawer's search box gets its own `id`, so the page never has two `id="global-search"`.
  - Search's Movies/TV result cards reuse `Movie`/`TVShowCard`, which gives them a watchlist button and title-specific accessible names.
- **Theme and conventions**:
  - The detail-page watchlist icon uses `IN_WATCHLIST_BLUE` / `useActionIconColor()` like every other watchlist icon.
  - `.detail-backdrop-gradient` gets a light-theme sibling, and `.glass-card`'s shadow is scoped per theme.
  - Profile's fallback avatar uses `avatarColor()` and the shared initials helper.
  - Stats uses `ratingColor()` from `utils/colors.ts` instead of its own copy.
  - Budget and revenue are formatted with a fixed `en-US` locale (they are USD amounts).
- **Plausible/minor (fix where confirmed)**: Search/People skeletons nested in an extra `Row`; a duplicate cast `key` for a person with two roles; `NotFoundPage` re-implementing `isPlainClick`; FilterPanel year cap (2030) and no from ≤ to check; SearchBox not following `?q=` or a picked recent search; the 10-star `StarRating` wrapping at 320 px.

No backend, API, nginx or migration changes.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `load-states`: For You distinguishes a failed watched load and a partial group failure; person credits failures, People search with no matches and the Lists background reload get honest states; the TMDB status check shows loading before it answers.
- `write-feedback`: the readable-error rule covers the sign-in-adjacent pages (register, forgot and reset password).
- `browse-filters`: "Include Adult Content" is part of the filter drawer's draft; category buttons are disabled while search or filters are active, since they can't change the results then; the Anime toggle sends one request.
- `accessibility`: filter drawer controls and Add to List checkboxes have accessible names; ids are unique; search result cards name their title.
- `user-lists`: the Delete confirm on a list card never opens the list.
- `routing`: unknown or malformed query values (`tab`, `page`, `pageSize`) fall back to the defaults.
- `theme-readability`: the detail-page watchlist icon and the detail backdrop follow the active theme.

## Impact

- Pages: `ListsPage`, `RecommendationsPage`, `PersonPage`, `ResetPasswordPage`, `ForgotPasswordPage`, `RegisterPage`, `WatchedPage`, `PeoplePage`, `HomePage`, `AnimePage`, `SearchPage`, `StatsPage`, `NotFoundPage`.
- Components: `ProfileModal`, `layout/FilterPanel`, `AddToListModal`, `SearchBox`, `BottomNav`, `MovieDetails`, `TVShowDetails`, `Movie`, `TVShowCard`, `SkeletonCard` callers, `StarRating`.
- Styles: `App.css` (backdrop gradient, `.glass-card` shadow).
- State: `UIContext`/`App.tsx` (adult setting moves into the filter draft's apply path).
- Tests: Jest for the new states, e2e updates for Lists delete (`test_lists.py`), filter drawer, Add to List and Search cards. Item 34's Lists e2e fix overlaps with the Lists delete test; this change fixes only that test, not the rest of item 34.
- `docs/BUG_BACKLOG.md`: item 32 marked proposed.
