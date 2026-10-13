## 1. Backend

- [x] 1.1 `ratings_views.ratings_list` POST: call `_sync_rating_to_tmdb` only when `created or entry.user_rating != old_rating`, and keep stamping `rated_at`.
- [x] 1.2 Test (`test_ratings.py`), with TMDB sync patched and a connected profile:
  - a new rating syncs, and a score change syncs
  - a POST that changes only the review doesn't sync, and its `ratedAt` moves
- [x] 1.3 `notifications_views`: load the user's watched `(media_id, media_type)` pairs once on the request thread, and skip matching items.
- [x] 1.4 Test (`test_notifications.py`): a followed person's recent release that the user watched isn't listed; an unwatched one is.
- [x] 1.5 `auth_views`: add `_lock_email()` (`pg_advisory_xact_lock(hashtext(lower(%s)))`). `register` and the `profile` PATCH (email changed only) re-check uniqueness under the lock inside `transaction.atomic()`, and answer `400 {"email": [...]}` on a clash.
- [x] 1.6 Tests (`test_profile.py` / `test_auth.py`):
  - the check under the lock rejects a clash the serializer missed (patch `validate_email` to pass)
  - with two threads switching to the same address against the real DB (`TransactionTestCase`), exactly one succeeds

## 2. Episode progress (frontend)

- [x] 2.1 `useEpisodeProgress`:
  - `error` and `retry()` (a retry token in the effect)
  - `update`/`clear` through a hook-local `createInflight()` keyed by show
  - `busy`
  - the stale-show guard stays
- [x] 2.2 `TVShowDetails`:
  - when `error`, show the inline "Couldn't load your episode progress" with Retry, and no Track/Edit/Next/Remove
  - Next, Save and Remove take `disabled={busy}`
- [x] 2.3 Jest `useEpisodeProgress.test.ts`:
  - a failed load sets `error`, and `retry` loads the progress
  - a double `update` sends one request

## 3. Dialogs and confirm buttons (frontend)

- [x] 3.1 `RatingModal`: while busy, block `onCancel`, the mask click, the Escape key and the close button, and disable Cancel.
- [x] 3.2 Add `src/components/ConfirmIconButton.tsx`: a Popconfirm plus a Tooltip that hides while the confirm is open.
- [x] 3.3 Use it for the card unmark/remove actions in `WatchedPage`, `WatchlistPage` and `ListDetailPage`. Keep the `aria-label`s and texts the tests use.

## 4. Navigation (frontend)

- [x] 4.1 Add `src/utils/goBack.ts` (design §5), with Jest tests for `from`, `idx > 0` and `idx 0` or no state.
- [x] 4.2 Use it in `MovieDetails` (fallback `/movies`), `TVShowDetails` (`/tv`) and `PersonPage` (`/people`).
- [x] 4.3 `PeoplePage.handlePersonClick`: call `stashReturnState({ scrollY, loadedPages: currentPage, isReturn: true })` before `navigate`.

## 5. Filter drawer (frontend)

- [x] 5.1 Add a `setGenres(ids)` setter to `UIContext` (type in `types/context.ts`, exposed through `useAppContext`).
- [x] 5.2 `FilterPanel`:
  - draft `filters`, `sortBy` and `genres`, re-seeded from the applied values whenever `open` becomes true
  - chips toggle the draft
  - Apply calls `onApply` and `setGenres` in one handler
  - Reset as today

## 6. Follows, lists and notifications (frontend)

- [x] 6.1 `FollowedPeopleContext`:
  - expose `changes` (incremented on a successful follow or unfollow)
  - `follow` prepends the new entry
- [x] 6.2 `NotificationsProvider`: `refresh()` when `useFollowedPeople().changes` changes, skipping the first value, without calling `request()`.
- [x] 6.3 `useLists.createList` prepends the new list.
- [x] 6.4 `WatchProviders`:
  - links through `safeHttpUrl`
  - no `<a>` when no safe URL is left

## 7. Tests and docs

- [x] 7.1 Jest:
  - `FollowedPeopleContext` (prepend, `changes`)
  - `useNotifications` (refreshes after a follow change)
  - `useLists` (prepend)
  - `WatchProviders` (a `javascript:` link is not rendered as a link)
- [x] 7.2 Targeted e2e (only the specs touched):
  - `write-feedback`:
    - episode-progress load failure shows Retry and no Track
    - the rating dialog can't be closed mid-save
  - `library-filters`: the unmark test clicks Confirm without the keyboard workaround, on both projects
  - `detail-and-nav`: Back on a detail page opened in a new tab goes to `/movies`
  - `browse-restore` or `responsive`:
    - close-without-apply leaves no draft
    - applying a genre sends exactly one discover request
    - browser Back to People restores the pages
- [x] 7.3 CLAUDE.md:
  - the "Load and write feedback" bullet: `ConfirmIconButton` for confirm-icon actions, and `goBack` for detail Back
  - the browse-filters bullet: the drawer is a draft, applied in one batch
  - remove the BUG_BACKLOG 25 workaround note from `library-filters.spec.ts`
- [x] 7.4 Run the checks:
  - backend `pytest`, `ruff`, `makemigrations --check` (no changes expected)
  - `npm run typecheck`, `npm run lint`, Jest
  - the targeted e2e from 7.2
- [x] 7.5 `docs/BUG_BACKLOG.md`:
  - item 25 → 📝 now, ✅ at archive
  - note the two items already fixed in 21c, and the three live-run findings folded in
