## Why

The frontend state pass of the fifth audit (backlog item 33) found that a failed first page on Home or Anime starts an endless request loop behind the error screen, that one account's browse settings (including "include adult") carry over to the next account in the tab, and that library state can briefly or lastingly disagree with the server after a reload, a clear or a sign-in. Each of these was checked against the code. They come after items 30 and 31 because none writes to the wrong account, but the loop spends the user's TMDB rate limit and can hide every other page's results behind 429s.

## What Changes

- **A failed first page doesn't load more pages.** Infinite scroll stays off while the page shows its load error, on every page that uses it. Retry reloads page 1.
- **Browse settings end with the session.** Signing out clears the search term, "include adult", the genre picks and the applied browse filters and sort, so the next account starts from the defaults.
- **Follow buttons wait for the followed-people list.** While it loads, Follow/Unfollow is disabled, so a follow made during the load can't be undone by it, and someone already followed never shows "Follow".
- **Library reloads can't undo a newer write.** A watched, watchlist, ratings or lists reload that started before a write finished is discarded and run again, so it can't drop an item that was just added (or bring back one just removed). Unmark then works straight away.
- **Clearing waits for, and is waited on by, item writes.** Clear All on Watched and Watchlist, and Clear on a list, run only after that library's pending item writes finish. Item writes started during a clear wait for it. The screen then matches the server's order of events.
- **Library pages count as loading from the first render after sign-in.** `/watched?page=3` keeps its page, and the empty state doesn't flash before the data arrives.
- **Ratings get the per-item double-click guard** the other library hooks have.
- **A different action on a library item queues instead of sharing the pending one.** Unmark while Mark watched is saving now waits and then unmarks, as the write-feedback spec already requires since item 31. The library hooks shared one slot per title for add and remove.
- **Mark-seen can't be undone by a poll that raced it.** A poll that started before the mark-seen request finished is ignored.
- **Downloads aren't cancelled by revoking the file's URL too early.** The CSV, backup, template and calendar downloads go through one helper that revokes the URL after the download has started.
- **A request replayed after a token refresh can't start a second refresh.** If it gets a 401 again, it fails instead of spending another refresh.
- **Signing out on purpose forgets the page.** After signing out, deleting the account, or a sign-out in another tab, the next sign-in in that tab goes to the default page, not the previous account's last page. An expired session (forced logout) still returns to the page the user was on.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `load-states`: a failed first page never triggers more page loads; library pages are loading, not empty, until their first load for the session finishes.
- `auth-session`: browse settings are cleared on sign-out; a replayed request never starts a second refresh; an intentional sign-out doesn't carry the return path to the next sign-in.
- `write-feedback`: library reloads don't undo newer writes; clears and item writes are ordered; ratings have the per-item guard and different actions on one library item queue; follow controls are disabled while follow state loads.
- `data-backup`: file downloads (exports, backup, templates, calendar) are not cut short.
- `notifications`: mark-seen is not undone by a poll that raced its request.

## Impact

- Frontend:
  - Paging: `src/hooks/usePaginatedFetch.ts`, `HomePage.tsx`, `AnimePage.tsx`
  - Session-scoped UI: `src/context/UIContext.tsx`, `App.tsx` (filters, sort, route guard), `src/context/AuthContext.tsx`
  - Library hooks: `useWatched.ts`, `useWatchlist.ts`, `useRatings.ts`, `useLists.ts`, and `src/utils/inflight.ts` (an idle wait)
  - Follow, notifications and auth: `PersonCard.tsx`, `src/hooks/useNotifications.ts`, `src/api/userApi.ts` (refresh queue)
  - Downloads: `src/utils/export.ts`, `CalendarPage.tsx`, `CSVListImportModal.tsx`
- Tests: Jest for each hook and helper, and the touched e2e specs only.
- No backend change.
- Docs: CLAUDE.md (session-scoped UI state, library write ordering, download helper), CHANGELOG, `docs/BUG_BACKLOG.md`.
