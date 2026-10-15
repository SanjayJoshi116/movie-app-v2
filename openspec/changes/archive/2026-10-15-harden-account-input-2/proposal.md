## Why

Backlog item 39 (sixth audit). Two account gaps and a nit:

- **A username can be changed without the password.** `UserProfileUpdateSerializer.validate` asks for `current_password` only for email and password changes. Sign-in is by username, so someone holding a stolen access token can rename the account and the owner can no longer sign in (the password-reset email does carry the new name, so it's recoverable, but only if the owner thinks of it). Changing the email already needs the password; the username is the other half of the login.
- **No password-similarity check.** `AUTH_PASSWORD_VALIDATORS` lacks Django's default `UserAttributeSimilarityValidator`, and registration validates the password without the user, so `alice2024` is accepted for user `alice`. (The backlog's `alicealice` example scores below Django's default 0.7 similarity threshold and stays accepted; the default is kept.)
- **Nit:** the per-username failure counter folds case (`alice` and `Alice` share a counter) while usernames are case-sensitive and sign-in matches them exactly. A guess at `ALICE` can't sign in as `alice`, so folding only lets failures on one account lock another that differs by case.

## What Changes

- A profile update that changes the username SHALL need the correct current password, like an email change, and counts a wrong one toward the per-username limit (it already does for every password-gated action). The account's email (if any) is told the username changed, after commit, without delaying the response.
- Passwords SHALL NOT be too similar to the account's username, email or name, at registration, on a profile password change and on a password reset.
- The per-username failure counter keys on the exact username.
- The profile dialog sends the current password with a username change, and its hint names username too.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `account-security`: username changes need the current password and notify the account email; passwords can't resemble the account's details; the per-username limit is per exact username.

## Impact

- Backend: `serializers.py` (`UserProfileUpdateSerializer.validate`, `RegisterSerializer`), `auth_views.py` (username-change notice, failure key), `settings.py` (`AUTH_PASSWORD_VALIDATORS`).
- Frontend: `ProfileModal.tsx` (send `current_password` when the username changes; hint text).
- Tests: account-security pytest (username change, similarity on register/profile/reset, case-exact limit); existing tests whose passwords resemble their usernames get new passwords; ProfileModal Jest; the Python profile e2e if it renames without a password.
- Existing failure-counter rows were keyed on the folded name; for up to an hour, a counter for a name with capitals restarts. Acceptable.
- No migration, no dependency.
