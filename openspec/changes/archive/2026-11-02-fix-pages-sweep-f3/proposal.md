## Why

The F3 module sweep (`src/pages`, backlog item 58) found ten confirmed page-level bugs. Movies, TV and Anime send a wasted grid request with a stale genre or the other mode's filters. Two pages write through `toggle`, so a stale render can do the opposite of what was clicked and still report success. The Create/Edit List dialogs close mid-save. Password reset double-submits on Enter. The People search box can show a stale term. A malformed photos answer crashes the person page. Watched and Watchlist can get stuck on a blank page after a failed reload. The `/security-review` of the module found nothing.

## What Changes

- **Browse genres:** applied genres move from `UIContext` into `App`'s applied-filter state. They reset in the same render as the filters when the browse scope changes, and are kept when the same scope is visited again, like the filters. Pages stop clearing genres in a mount effect. The first grid request never carries the previous scope's genres, and is never followed by a second request without them.
- **Anime mode:** `App` remembers the Anime mode. A normal visit to Anime opens in that remembered mode, so the mode and the kept filters agree on the first request. Back still restores the saved mode.
- **Explicit writes:** the Recommendations card and the Watchlist page mark and unmark watched, and add and remove watchlist entries, through explicit add/remove, never `toggle`. Each toast names the action that actually ran, as `MediaCard` does.
- **List dialogs hold while saving:** the Create List and Edit List dialogs can't be closed while their write runs, and keep what was typed when it fails.
- **Reset and Forgot password submit once:** a ref guard stops a second Enter from sending a second request.
- **People search box follows the address:** the box shows the `?q=` term whenever it changes from outside typing (sidebar People, Back/Forward).
- **Person photos are shape-checked:** a photos answer without a `profiles` list hides the Photos tab instead of crashing the page.
- **Library pagination after a failed reload:** Watched and Watchlist still move off an empty page when a reload failed but the loaded list was kept.
- **Cheap folds:**
  - Memoize Watched's sort functions and Watchlist's watched filter, so the library isn't re-sorted on every render.
  - The Calendar's "All" view fetches movies and TV in parallel.
  - The list page's tab title names its not-found or error state.
  - Saved filter values read back from sessionStorage are validated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `browse-filters`: genres follow the applied-filter scope rule (kept on a same-scope revisit, dropped on a scope change, never sent stale). Anime opens in the remembered mode. The People search field follows `?q=`.
- `library-filters`: Watched/Watchlist pagination moves off an empty page after a reload failure that kept the list. Restored filter values are validated.
- `write-feedback`: watched/watchlist writes from Recommendations and the Watchlist are explicit, never toggles. List dialogs hold while saving. Password reset and forgot-password submit once.
- `load-states`: a malformed person photos answer hides Photos only.
- `accessibility`: the list page is titled with its not-found or error heading.

## Impact

- Frontend only: `src/App.tsx`, `src/context/UIContext.tsx` and `src/types/context.ts` (genres removed), `src/components/layout/FilterPanel.tsx` (genres via props), and these pages: `HomePage`, `AnimePage`, `RecommendationsPage`, `WatchlistPage`, `WatchedPage`, `ListsPage`, `ListDetailPage`, `ResetPasswordPage`, `ForgotPasswordPage`, `PeoplePage`, `PersonPage`, `CalendarPage`.
- No backend, API or dependency change.
- Jest tests for the touched pages and contexts; touched e2e specs: browse filters, lists, people, auth pages.
- CLAUDE.md's "Browse filters and Back restore" and "Adult content toggle" bullets mention `UIContext.setGenres`, so they need updating.
