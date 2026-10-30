## Context

Item 52, checked against the code on 2026-10-30:

- `AuthContext.updateProfile` awaits `PATCH /auth/profile/`, then writes `access`/`refresh` and calls `setUserData`, which writes `cinedb_user` and calls the `setUser` wrapper (`bindSessionUser`). No generation or bound-user check. `ProfileModal` calls `setUserData` after `uploadAvatar`/`removeAvatar`. The modal is `<Modal onCancel={onClose}>` with no busy guard.
- `userApi`'s 401 path calls `forceLogout()` when `cinedb_refresh` is missing, whatever the stored account. The request interceptor already throws `SessionChangedError` when `storedUserId() !== boundUserId`, but only before sending.
- `FollowedPeopleProvider`'s load effect applies `getFollowedPeople()` with only a `cancelled` flag; `follow`/`unfollow` already check `isCurrentSession`. The library hooks use `guardedReload(writeSeq, fetch, apply)` with a `writeSeq` the inflight's `onSettle` bumps.
- `tmdb.ts`'s request interceptor attaches `cinedb_access` unconditionally; a 401 retries once without it, every time.
- `useLocalStorage` returns a new `setValue` each render; `UIContext` puts `setTheme`/`setRegion` (and `toggleTheme`, derived) in its memo deps.
- `SessionChangedError` (not exported) and `SessionEndedError` are unrelated classes; the import dialogs swallow only the latter.
- `fetchTrending` returns `TMDBPaginatedResponse<TMDBMovieSummary>` for every media type; `HeroBanner` calls it with `movie` or `tv`.

## Goals / Non-Goals

**Goals:** all ten findings.

**Non-Goals:** a request timeout on `userApi` (would also cut long imports; the session checks make a late answer harmless); making `getApiError` hide `SessionChangedError` toasts in the moment before the reload (the reload follows at once).

## Decisions

1. **Profile and avatar results are session-checked in `AuthContext`.** `updateProfile` captures `currentSessionGeneration()` before the await and, after it, returns without storing anything unless `isCurrentSession(gen)` and `body.id === userRef.current?.id`. `setUserData(updated)` ignores `updated` when `userRef.current` is null or its id differs. ProfileModal's avatar handlers then need no change; their success toast is skipped by the same check (they test the return value: `setUserData` returns whether it applied).
2. **ProfileModal holds while busy.** `busy = loading || avatarLoading || deleteLoading`; while busy: `closable={false}`, `maskClosable={false}`, `keyboard={false}`, `onCancel` a no-op. Same pattern as `RatingModal`.
3. **401 without a refresh token: session check first.** Export `SessionChangedError`, make it extend `SessionEndedError`. In the 401 branch, before `forceLogout()`, `if (boundUserId !== null && storedUserId() !== boundUserId) return Promise.reject(new SessionChangedError())`. The `storage` handler then does what it already does (sign out or reload).
4. **Followed people use `guardedReload`.** A `writeSeq` ref, bumped in `follow`/`unfollow` after their write settles (success or failure). The load effect captures the generation, runs `guardedReload(writeSeq, getFollowedPeople, apply)`, and drops `apply`/error/finally unless `isCurrentSession(gen)` and not `cancelled`.
5. **TMDB token.** Export `currentAccessToken()` from `userApi`: the stored access token only when `boundUserId === null || storedUserId() === boundUserId`. `tmdb.ts` uses it, and keeps a module-level `refusedToken`: on a 401 for a request that carried token T, set `refusedToken = T`; the interceptor skips the header while the stored token equals `refusedToken`. A refresh stores a new token, which is then sent again.
6. **Stable setter.** `useLocalStorage`'s `setValue` in `useCallback([key])` (it reads only refs and `key`).
7. **`fetchTrending` typed by media type** with overloads: `movie` → `TMDBMovieSummary`, `tv` → `TMDBTVSummary`, `all` → the union.

## Risks / Trade-offs

- `SessionChangedError` extending `SessionEndedError` changes which errors the import dialogs swallow: a refused request mid-import now ends the run quietly instead of counting a failed chunk. That is the intended outcome (the tab is about to reload).
- `refusedToken` is per page load; a fresh page sends the stored token once more. Acceptable.
- Holding the dialog during account deletion means a hung delete keeps it open until the request fails; there is no request timeout, but the server answers deletion promptly.
