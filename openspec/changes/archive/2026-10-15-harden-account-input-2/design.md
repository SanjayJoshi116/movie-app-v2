## Context

See proposal.md for why. Today:

- `UserProfileUpdateSerializer.validate` (`serializers.py`) calls `_require_current_password(data, purpose)` for an email change (case-insensitive compare) and for `new_password`. A wrong password sets `password_rejected`, and the `profile` view records a failure against the per-username limit. `validate_username` checks uniqueness only.
- `profile` (`auth_views.py`) sends the email-change notice with `transaction.on_commit(lambda: _notify_email_changed(...))`, which mails from a daemon thread (`_in_background`), never touching the ORM there.
- `RegisterSerializer.validate_password` calls `validate_password(value)` with no user. `password_reset_confirm` and the profile already pass `user=user`.
- `AUTH_PASSWORD_VALIDATORS` = MinimumLength, CommonPassword, Numeric.
- `_login_failure_key(username)` hashes `username.strip().lower()`. Django's `ModelBackend` matches usernames exactly.
- `ProfileModal.tsx` sends `current_password` only when the email changes or a new password is set; the field hint says "Required to change email or password".

## Goals / Non-Goals

**Goals:** the username is guarded like the email; a password can't be the account's own details; the failure counter matches what sign-in matches.

**Non-Goals:** case-insensitive unique usernames (would need a migration and a policy for existing collisions); combining the email and username notices into one message; removing the unused `is_staff` from `UserSerializer` (touches the frontend type and mocks for no behaviour).

## Decisions

**1. Username change uses the existing password gate.**
In `validate`, if `username` is present and differs from `user.username` (exact compare: a case change is a change), call `_require_current_password(data, "username")`. The view's failure counting and 429 pre-check already cover any `current_password` in the body, so nothing changes there.

**2. Notice to the account's address on file before the update.**
`_notify_username_changed(user_pk, old_username, new_username, address)` mirrors `_notify_email_changed`: plain values, `transaction.on_commit`, daemon thread, broad except with a comment. Sent to `old_email` (the address before this update), so a stolen-token rename plus email change still reaches the owner. No email on file → no notice. If both change in one update, both notices go out (two short messages beat a combined template for two rare paths).

**3. Similarity validator, with the account's pending details.**
Add `UserAttributeSimilarityValidator` first in `AUTH_PASSWORD_VALIDATORS` (Django's default list order). Registration moves its password check to object-level `validate`, building an unsaved `User(username=…, email=…)` so the validator sees both, and raises `{"password": [...]}` so the frontend's first-field-error display keeps working. The profile builds an unsaved copy carrying the update's username, email and names (the values the account will have) before `validate_password(new_password, user=copy)`. Reset is unchanged (`user=user`). The default `max_similarity` (0.7) is kept: it rejects `alice2024` for `alice` (0.77) but not `alicealice` (0.67); a stricter value was not worth the false rejections on short usernames.
*Alternative:* a custom check against the username only (Django's validator already handles email local parts, names and its 0.7 similarity threshold).

**4. Failure key = exact username.**
`hashlib.sha256(username.encode())`, no strip or lower, matching `ModelBackend`. Existing rows keyed on folded names stop matching names with capitals; they expire within the one-hour window.

**5. Profile dialog.**
`usernameChanged = payload.username !== user.username`; keep `current_password` when `emailChanged || usernameChanged || new_password`. Hint: "Required to change username, email or password".

## Risks / Trade-offs

- [The similarity validator rejects some passwords users already type] → only new passwords; existing ones keep working. The message names the attribute.
- [Test fixtures with passwords resembling usernames] → measured: fixtures use a random-looking shared password; the e2e register flows will be checked.
- [Counter rows keyed on folded names] → expire within an hour; worst case one window restarts for capitalised usernames.

## Migration Plan

No migration. Ships with the next deploy.
