## 1. Account updates (decisions 1, 2)

- [x] 1.1 `AuthContext`: `updateProfile` drops tokens and user unless the session is current and the returned id is the bound one; `setUserData` ignores a user that isn't the bound account and returns whether it applied
- [x] 1.2 `ProfileModal`: avatar handlers toast success only when `setUserData` applied; the modal holds (no close button, mask, Escape) while a save, avatar change or deletion is in flight
- [x] 1.3 Jest: password change answered after sign-out + sign-in as B leaves B's tokens and user; avatar response after the switch leaves B's user; modal can't close while saving

## 2. Session plumbing (decisions 3, 5)

- [x] 2.1 `userApi`: export `SessionChangedError` as a `SessionEndedError`; a 401 with no refresh token rejects with it when the stored account isn't the bound one, instead of `forceLogout()`; export `currentAccessToken()`
- [x] 2.2 `tmdb.ts`: attach `currentAccessToken()`; remember a refused token and send none while it's still the stored one
- [x] 2.3 Jest: the 401-after-other-tab-signout case doesn't call `forceLogout`; TMDB requests omit a token from another account; after one 401, later TMDB requests go out once without the token, and a newly stored token is sent again

## 3. Followed people (decision 4)

- [x] 3.1 `FollowedPeopleProvider`: load through `guardedReload` with a `writeSeq` bumped when a follow/unfollow settles; drop results from a previous session
- [x] 3.2 Jest: a reload that returns without a person followed meanwhile is rerun and keeps them; a load answered after sign-out applies nothing

## 4. Cleanups (decisions 6, 7)

- [x] 4.1 `useLocalStorage` setter in `useCallback([key])`; Jest: identity stable across renders
- [x] 4.2 `fetchTrending` overloads by media type; `HeroBanner` typechecks without casts

## 5. Docs and verify

- [x] 5.1 `CLAUDE.md` session bullet: profile/avatar results are session-checked, `setUserData` ignores another account, a 401 after another tab's change rejects as `SessionChangedError` (a `SessionEndedError`), the TMDB client sends only `currentAccessToken()`; followed people use `guardedReload`. `docs/BUG_BACKLOG.md` item 52: verdicts and 📝 `fix-session-sweep-f1`
- [x] 5.2 `npm run typecheck`, `npm run lint`, Jest (`--maxWorkers=2`); e2e only for specs touching the profile dialog, following and auth (`auth.spec.ts`, `detail-and-nav.spec.ts`, Python `test_auth.py`, `test_following.py` if present)
