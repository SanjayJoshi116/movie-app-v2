## Why

The module review sweep's third pass, over the frontend API, auth and session code (BUG_BACKLOG item 52, `/code-review high` and `/security-review` on 2026-10-30), found ten issues; checked against the code, all hold, two at low impact. The worst: a password change whose response lands after the user signed out and someone else signed in installs the first account's fresh tokens in the tab (and, through the `storage` event, in every tab). The security review rated it a correctness and privacy bug rather than an exploitable vulnerability (it needs the first user to abandon a pending save), but it hands one person's session to another. Most findings are the same gap: code that updates the signed-in account, or acts on it, without the session-generation and bound-account checks the rest of the client already uses.

## What Changes

- **Account updates apply only to the session that made them.** `updateProfile` drops its result (tokens and user) unless the session is still the one that sent it and the returned user is the bound account; `setUserData` ignores a user whose id isn't the bound account's. That covers late avatar uploads and removals too.
- **Edit Profile can't be closed while a save, avatar change or deletion is in flight** (no close button, mask, Escape), as the repo's rule for dialogs with a write in flight requires. This also removes the main way to sign out with a profile save still pending.
- **A 401 with no refresh token after another tab changed the account no longer forces a logout.** When the stored account differs from the tab's bound one, the request fails as a session change (no reload, no "return to this page" for the next account).
- **Followed people reload like the library.** A reload that started before a follow or unfollow settled is run again instead of overwriting it, and a result from a previous session is dropped.
- **TMDB requests send only this tab's account token, and stop resending after a 401.** The TMDB client attaches the token only while the stored account is the bound one, and once a token is refused it sends none until a new token is stored, so an expired token no longer doubles every browse request.
- **Requests refused during an account switch end imports quietly.** `SessionChangedError` becomes a `SessionEndedError`, which the import dialogs already treat as "the session ended, drop the run".
- **Cleanups:** `useLocalStorage`'s setter is stable (so `UIContext`'s memo holds); `fetchTrending` is typed by media type.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auth-session`: late profile and avatar responses are discarded like other previous-session responses; a request refused because another tab changed the account doesn't force a logout; TMDB requests carry only the tab's own account token and an expired token is sent once.
- `write-feedback`: followed people follow the library's "a reload never undoes a newer write" rule; Edit Profile holds while a write is in flight.

## Impact

- Frontend only: `src/context/AuthContext.tsx`, `src/context/FollowedPeopleContext.tsx`, `src/api/userApi.ts`, `src/api/tmdb.ts`, `src/hooks/useLocalStorage.ts`, `src/components/ProfileModal.tsx`; Jest tests next to each.
- No backend, API, route or dependency change.
