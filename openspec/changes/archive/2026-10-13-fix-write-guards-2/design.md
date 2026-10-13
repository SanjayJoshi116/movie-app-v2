## Context

`proposal.md` lists the findings, all re-checked on 2026-10-13. These parts of today's code shape the design:

- **Episode progress.** `useEpisodeProgress` maps a failed GET to `progress = null`, the same value as "never tracked". Its `update`/`clear` have no in-flight slot. The other library hooks use `createInflight()` (`src/utils/inflight.ts`).
- **Ratings.** `ratings_views.ratings_list` POST already reads the old score (added in `fix-recs-correctness`) to decide whether to refresh recommendations. It still calls `_sync_rating_to_tmdb` on every save.
- **Rating dialog.** `RatingModal` has a `busy` state but passes `onCancel={onClose}` unconditionally.
- **Library cards.** Watched, Watchlist and List detail cards each hand-roll `<Popconfirm><Tooltip><Button/></Tooltip></Popconfirm>`, so the tooltip and the confirm open together.
- **Back.** The detail and person Back buttons call `navigate(-1)` when they have no `from`. React Router stores `idx` in `window.history.state`, and `idx === 0` (or no state) means the app has no earlier entry.
- **Filter drawer.** `FilterPanel` seeds its draft `filters`/`sortBy` only on mount and on a scope change. Genre chips write straight to `UIContext.selectedGenres`, which every browse page reads, so a chip refetches at once and Apply refetches again.
- **Followed people and notifications.** `FollowedPeopleProvider` wraps `NotificationsProvider` in `index.tsx`. The followed-people provider is lazy on purpose (CLAUDE.md). The notifications endpoint builds its items from cached credits without looking at watched entries.
- **Email.** `RegisterSerializer`/`ProfileSerializer` check email uniqueness before the save. `auth_user.email` has no unique index, and older accounts may already share an address (`password_reset_request` uses `.first()` for that reason).

## Goals / Non-Goals

**Goals:** close every finding listed in the proposal with the smallest change that matches an existing pattern, and pin each one with a test.

**Non-Goals:**
- No unique DB index on email (existing duplicates).
- No redesign of the filter drawer layout.
- No change to how often notifications poll.
- The PATCH path for ratings is already correct and stays as it is.

## Decisions

### 1. Episode progress gets `error`, `retry` and an in-flight slot
- **Hook.** `useEpisodeProgress` returns `{ progress, loading, error, retry, update, clear, busy }`.
  - A failed load sets `error` and keeps `progress` as `null`. `retry()` bumps a token the effect depends on.
  - `update`/`clear` run through a hook-local `createInflight()`, keyed by show id.
  - `busy` is true while a write is in flight.
- **TV page.** It renders three states:
  - `error`: "Couldn't load your episode progress" with a Retry button, as a compact inline row like the existing control, not a full-page `LoadError`.
  - `loading`: nothing.
  - otherwise: today's UI.
- Next, Save and Remove pass `disabled={busy}`. `loading` was dropped: after it ends, antd leaves the spinner (labelled "loading") in the button, so a screen reader announces "loading Save".

Rejected: disabling the buttons at each call site. CLAUDE.md puts the guard in the hook.

### 2. The ratings POST syncs to TMDB only on a score change
In `ratings_list` POST, `_sync_rating_to_tmdb` runs only when `created or entry.user_rating != old_rating`, the same condition that already decides `schedule_refresh`. `rated_at` is still stamped on every save, as the `ratings` spec requires.

Rejected: switching the frontend to PATCH for edits. The backend fix covers every client, and `useRatings.set` stays one call.

### 3. RatingModal blocks closing while busy
`onCancel={busy ? undefined : onClose}`, plus `maskClosable={!busy}`, `keyboard={!busy}` and `closable={!busy}`. The Cancel button gets `disabled={busy !== null}`.

### 4. `ConfirmIconButton` owns the tooltip/confirm pairing
A new `src/components/ConfirmIconButton.tsx` takes `title`, `okText`, `onConfirm`, `tooltip`, `icon`, `ariaLabel`, `danger?` and `style?`.
- It keeps `confirmOpen` from the Popconfirm's `onOpenChange` and passes `open={confirmOpen ? false : undefined}` to its Tooltip.
- The button keeps `onClick={(e) => e.stopPropagation()}`, so `LibraryItemCard` behavior is unchanged.

The three pages' unmark and remove card actions switch to it. Page-level "Clear All" buttons have no tooltip, so they stay as they are. The keyboard workaround in `e2e/library-filters.spec.ts` goes back to a plain click.

### 5. One Back helper
`src/utils/goBack.ts` exports `goBack(navigate, { from, state, fallback })`:
- with `from`: `navigate(from, { state })`
- else, when `window.history.state?.idx > 0`: `navigate(-1)`
- else: `navigate(fallback, { replace: true })`

The fallbacks are `/movies` for MovieDetails, `/tv` for TVShowDetails and `/people` for PersonPage. Replace keeps browser Back from cycling back to the orphan detail page.

### 6. People page stashes its return state
`handlePersonClick` calls `stashReturnState({ scrollY, loadedPages: currentPage, isReturn: true })` before `navigate`, the same as `HomePage`/`AnimePage`. `PeoplePage` already restores from `location.state` through `usePaginatedFetch`.

### 7. The filter drawer is a draft, re-seeded on open
- **Draft.** `FilterPanel` keeps `filters`, `sortBy` and `genres` in local state. An effect copies the applied values (`appliedFilters`, `appliedSortBy`, `selectedGenres`) into the draft whenever `open` turns true. Chips toggle the draft genres.
- **Apply.** Apply calls `onApply(filters, sortBy)` and `setGenres(draftGenres)` in the same click handler. React batches both, so the page renders once with the new genres and filters, `fetchPage` changes identity once, and one request goes out.
- **UIContext** gets a `setGenres(ids)` setter. `toggleGenre` stays for any other caller.
- **Reset** clears the draft and the applied values as today.

Why the double fetch goes away: the chip no longer changes `selectedGenres` before Apply, so there's no first fetch.

### 8. Follow changes nudge the notifications poller
- `FollowedPeopleContext` exposes `changes: number`, incremented after each successful follow or unfollow.
- `NotificationsProvider` (inside it) reads `useFollowedPeople().changes` and calls `refresh()` when it changes, skipping the initial value. Reading `changes` doesn't call `request()`, so the provider stays lazy.
- The backend's `new_releases` loads the user's watched `(media_id, media_type)` pairs once on the request thread and skips matching items. That's one indexed query per poll.

### 9. New items are inserted first
`useLists.createList` prepends with `[created, ...prev]`. `FollowedPeopleContext.follow` prepends after removing any existing entry for that person. Both match the APIs' `-created_at`/`-followed_at` order.

### 10. Email uniqueness is serialized with an advisory lock
- **A helper** `_lock_email(address)` runs `SELECT pg_advisory_xact_lock(hashtext(lower(%s)))`.
- **`register` and the `profile` PATCH** (only when the email changes) wrap the existing save in `transaction.atomic()`, take the lock, then re-check `User.objects.filter(email__iexact=new).exclude(pk=...).exists()`. If the check fails, they answer `400 {"email": ["An account with this email already exists."]}`, the serializer's existing message.
- Two requests for the same address serialize on the lock, and the second sees the first's committed row. Different addresses don't block each other.

Rejected: a unique index on `lower(email)`. It can't be built while duplicates exist, and cleaning them up is a data decision outside this change.

### 11. The provider link goes through `safeHttpUrl`
`getProviderUrl` returns `PROVIDER_SEARCH_URLS[id]?.(title) ?? safeHttpUrl(us.link) ?? null`. When it's `null`, the logo renders without an `<a>`.

## Risks / Trade-offs

- **Users expect chips to filter instantly.** The `browse-filters` spec now says changes apply together. The Apply button is already there, so it's the same model as the other fields.
- **The advisory lock is Postgres-only.** The project runs only on Postgres. A test drives two threads at the same address against the real DB.
- **`hashtext` collisions** serialize two different addresses now and then. That's harmless: a short extra wait.
- **Notifications now cost one more DB query per poll** (the watched pairs). It's indexed by user and small, and it runs on the request thread per CLAUDE.md.
- **The notification refresh after a follow** costs one more TMDB-backed poll. `NotificationsThrottle` is 30/min and follows are user-paced.
