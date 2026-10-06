## Why

The frontend often reports a failure as an empty result or as a success. Examples:
- A library load that fails shows "Your watchlist is empty".
- A Stats request that fails shows "Start watching…".
- A failed "mark as watched" still shows a green "Marked as watched" toast.
- A failed rating save throws away the review the user just typed.

Users can't tell "nothing here" from "something broke", and they don't see when their writes didn't happen. This is item 3 of `docs/BUG_BACKLOG.md`. It is next in order now that the backend input-validation work (#1) and backup round-trip work (#2) are done.

## What Changes

One rule across the frontend: **every load ends in one of four visible states (loading, error with retry, empty, content), and every write either confirms success after the server agrees or shows an error. A write never reports success early, and it never sends the same mutation twice.**

### Reads
- **Library data (watchlist, watched, ratings, lists):** loads record an error and start out "loading", never as "loaded and empty".
- **Library pages (Watchlist, Watched, List detail):** show a skeleton while loading and an error with Retry on failure. The empty-state call to action appears only after a load succeeds with zero items. List detail no longer flashes "List not found." before its data arrives.
- **Paginated browse/search grids:** switching category or query clears the previous results. A failed first page shows an error with Retry. A "load more" response from a previous query is discarded instead of appended.
- **Stats page:** a failed request shows an error with Retry, not the "Start watching…" empty state.
- **Movie and TV detail pages:** only the main details request is essential. Reviews, similar titles, providers, credits and images can each fail on their own, leaving only that section empty. An unknown id shows a "not found" state instead of the generic error. Retry refetches in place without reloading the whole page.
- **Person page:**
  - An unknown id shows "not found" and other failures show an error with Retry, instead of a blank page.
  - Changing the person id never shows the previous person's data.
  - A title the person has several credits in appears once, with the roles merged.
- **Episode guide:** switching back to a season that's already loaded never leaves the skeleton stuck. A failed season load shows an error with Retry.
- **Episode progress:** resets when the show changes, and a slow response for the previous show is ignored.

### Writes
- **Rating modal:**
  - Stays open with a saving indicator until the save finishes.
  - On failure it keeps the stars and review text.
  - A rated title gets a "Remove rating" action. The delete endpoint and hook already exist, but no UI exposed them.
- **Watchlist/Watched pages:**
  - Mark-watched/unwatched, clear-all, list clear/delete and remove-from-list all wait for the server, then show success or an error.
  - Follow/unfollow and episode-progress writes (next episode, clear, save) show an error on failure, and the episode editor stays open.
- **No duplicate requests:** a second click on the same item's toggle while the first request is in flight sends nothing more. This covers watchlist, watched, follow, and add/remove-to-list.
- **Typed promises:** the context types declare these mutations as returning promises, not `void`. This is a type-level fix, so it doesn't change behavior.

### Shared state
- **Followed people:** follow state is shared app-wide. A grid of person cards makes one request instead of one per card. Unfollowing from a card updates every view of that person, including the Following page.
- **Notifications:**
  - One poller instead of two, so the sidebar and bottom-nav badges always agree.
  - Items that were unread when the dropdown opened stay shown as unread while it's open. They're marked seen when it closes.
- **Danger Zone password:** cleared whenever the profile modal closes and after a failed account delete. Same for the new-password field.

## Capabilities

### New Capabilities
- `load-states`: every data load in the UI shows one of loading / error-with-retry / empty / content, with no stale or wrong-entity data. Covers library collections, paginated grids, stats, detail and person pages, the episode guide and episode progress.
- `write-feedback`: user-initiated writes report their real outcome, keep the user's input on failure, and send at most one request per item at a time. Covers ratings (including removal), watched/watchlist/list/follow toggles, bulk clears, episode progress, and follow state shared across views.
- `notifications`: one shared new-release poll per session, and a dropdown that shows which items are unread before marking them seen.

### Modified Capabilities
- `account-security`: adds a requirement that password fields in the profile modal (Danger Zone delete password, new password) don't keep their values after the modal closes or after a failed account deletion.

## Impact

- **Hooks:** `useWatched`, `useWatchlist`, `useRatings`, `useLists`, `usePaginatedFetch`, `useEpisodeProgress`, `useFollowedPeople` (moves behind a context), `useNotifications` (moves behind a context), `useToast`.
- **Contexts and types:** the existing Watchlist/Watched/Ratings/Lists contexts, `useAppContext`, `types/context.ts`, plus new FollowedPeople and Notifications providers.
- **Pages and components:** `WatchlistPage`, `WatchedPage`, `ListDetailPage`, `StatsPage`, `MovieDetailPage`, `TVDetailPage`, `PersonPage`, `HomePage`/`AnimePage`/`PeoplePage`/`SearchPage` (paginated error state), `EpisodeGuide`, `TVShowDetails`, `MovieDetails`, `RatingModal`, `PersonCard`, `FollowingPage`, `NotificationBell`, `ProfileModal`, `AddToListModal`, and a new shared load-error component.
- **Backend/API:** no changes. Rating DELETE (`ratings/<pk>/`) already exists.
- **Tests:** new Jest unit tests for the hooks (error state, in-flight guard, stale-response discard). Any e2e fixture changes stay within existing mocked endpoints, since no new endpoints are added.
