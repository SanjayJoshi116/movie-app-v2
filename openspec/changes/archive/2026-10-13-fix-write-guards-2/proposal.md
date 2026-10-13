## Why

Backlog item 25, plus three findings from the 2026-10-09 live run that were filed under it. Re-checked against the code on 2026-10-13. Two items are already fixed and dropped: the phone drawer's "Edit profile" label (fixed in 21c), and the password refocus after a failed login (21c's focus test passes). The rest are writes and controls that can lose or misreport data, or leave the user stranded:
- **Episode progress:**
  - A failed load looks like "no progress yet". Saving then overwrites the real position with S1E1.
  - "Next Episode →" and Save have no in-flight guard, so a double click sends two writes.
- **Ratings:** saving a rating with only a changed review still pushes the score to TMDB. The `ratings` spec says it must not.
- **Dialogs and controls:**
  - The rating dialog can be closed while a save is in flight, so its result is never shown.
  - On library cards, the icon's tooltip covers the Popconfirm's confirm button. On touch screens it stays open and blocks the tap (confirmed in 21c).
- **Navigation:**
  - On a detail page opened in a new tab, Back does nothing. From an external link, Back leaves the app.
  - Browser Back from a person to the People page loses the loaded pages and the scroll position.
- **Browse filters:**
  - The filter drawer shows edits the user never applied after it is closed and reopened.
  - Genre chips apply immediately, while the other fields wait for Apply.
  - Applying a genre fetches the same discover page twice.
- **Notifications:**
  - Following or unfollowing someone doesn't update them until the next 3-minute poll.
  - They list titles the user has already watched.
- **Order:** a newly created list or follow shows last until a reload, while the server puts it first.
- **Email:** two concurrent requests can register or switch to the same email address, because uniqueness is checked only before saving. Medium confidence, not reproduced.
- **Untrusted link:** a provider link from TMDB is used as an `href` without the web-scheme check that every other third-party URL gets.

## What Changes

**Episode progress (frontend)**
- `useEpisodeProgress` gains `error` and `retry()`.
- The TV page shows "Couldn't load your episode progress" with Retry, and hides Track/Edit/Next while the load has failed.
- Writes go through a per-show in-flight slot (`createInflight`). Their buttons show a loading state and ignore repeat clicks.

**Ratings (backend)**
- `POST /ratings/` sends the rating to TMDB only when the rating is new or its score changed.
- A review-only change still updates `ratedAt`, as the spec says.

**Rating dialog (frontend)**
- While a save or remove is in flight, Cancel, the close button, Escape and a mask click do nothing.

**Confirm buttons (frontend)**
- A shared `ConfirmIconButton` (Popconfirm, Tooltip and an icon button) hides its tooltip while the confirm is open.
- It's used for the library cards' unmark, remove and clear actions on Watched, Watchlist and List detail.

**Back (frontend)**
- Detail and person pages go back in history only when there is an in-app entry to go back to.
- Otherwise they navigate, with replace, to their section: `/movies`, `/tv` or `/people`.
- A shared helper does this for all three pages.

**People page Back (frontend)**
- `PeoplePage` stashes its return state before opening a person, the same as Movies, TV and Anime, so browser Back restores the loaded pages and the scroll position.

**Filter drawer (frontend)**
- The drawer's year, rating, runtime, language, sort and genre fields are a draft. The draft is re-seeded from the applied values each time the drawer opens.
- Genre chips become part of the draft. Apply commits genres and the other filters in one batched update, so the grid fetches once.
- Reset behaves as before.

**Notifications (backend + frontend)**
- The notifications endpoint leaves out titles the user has watched.
- The notifications poller refreshes once after each successful follow or unfollow. Following someone doesn't make the followed-people provider fetch eagerly.

**Order (frontend)**
- A new list and a new follow are inserted first, matching the server's newest-first order.

**Email uniqueness (backend)**
- Registration and profile updates take a per-address transaction lock (`pg_advisory_xact_lock` on the lowercased email). Under that lock they check uniqueness again before saving.
- No unique index is added: older accounts can already share an address, so an index would fail to build on existing data.

**Provider link (frontend)**
- `WatchProviders` runs TMDB's `link` through `safeHttpUrl`. When no safe URL is left, the logo renders as plain content rather than a link.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `load-states`: an episode-progress load failure is shown as a failure, not as "no progress".
- `write-feedback`:
  - the rating dialog can't be closed while saving
  - confirm buttons are never covered
  - a created list or follow appears where the server orders it
- `routing`: Back on a detail or person page always leads somewhere in the app.
- `view-state-restore`: browser Back restores the People page.
- `browse-filters`: drawer edits are a draft that is applied together, with one request per apply.
- `notifications`: follow changes refresh notifications, and watched titles are left out.
- `account-security`: email addresses stay unique under concurrent changes.

## Impact

- **Frontend:**
  - hooks and context: `useEpisodeProgress.ts`, `useLists.ts`, `FollowedPeopleContext.tsx`, `useNotifications.ts`, `UIContext.tsx` (a `setGenres` setter)
  - components: `TVShowDetails.tsx`, `MovieDetails.tsx`, `RatingModal.tsx`, `FilterPanel.tsx`, `WatchProviders.tsx`, a new `ConfirmIconButton.tsx`
  - pages: `PersonPage.tsx`, `PeoplePage.tsx`, `WatchedPage.tsx`, `WatchlistPage.tsx`, `ListDetailPage.tsx`
  - a new `src/utils/goBack.ts`
- **Backend:** `ratings_views.py`, `notifications_views.py`, `auth_views.py` (`register` and the `profile` PATCH), and tests.
- **Tests:**
  - Jest for the hooks and helpers
  - targeted e2e: `write-feedback`, `detail-and-nav`, `library-filters` (the keyboard workaround for the tooltip goes away), `responsive` (filters) and `notifications`
  - pytest for ratings, notifications and email
- **No migration**, and no API shape changes.
