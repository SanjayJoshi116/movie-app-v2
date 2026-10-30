## Why

The module review sweep's first pass over auth & account (BUG_BACKLOG item 50, `/code-review high` on 2026-10-30) found ten issues; checked against the code, seven hold. The worst: a profile edit in flight saves the whole user row, so it can put back the password hash a concurrent reset just replaced, and with it the old password and the old tokens' claim.

## What Changes

- **Profile edits save only what they change.** `profile` PATCH writes the edited fields (plus the password when a new one is set), never the full row loaded at authentication, so it can't revert a password reset or anything else committed meanwhile.
- **Checking `current_password` never rewrites the stored hash.** The profile serializer verifies with the plain hasher check (no upgrade-on-verify), once per request, however many sensitive fields change. A PATCH that then fails can no longer have changed the session's token claim; the view's "rehash only → reissue tokens" branch goes away.
- **A TMDB session created but not stored is revoked.** If storing the new session fails after TMDB issued it, it is revoked in the background (the old one stays, as today), and the single-use check on the request token becomes atomic (only the request whose delete removed the token proceeds).
- **Password reset reaches every account on the address.** A reset request mails one link per active account with a usable password whose email matches, instead of only the first; inactive and password-less accounts get none. The response stays the same either way.
- **A successful sign-in clears the username's failure count and records `last_login`.** Clearing matches how a reset already treats the count; `last_login` makes a sign-in end any reset link mailed earlier (Django's reset token covers it).
- **Low-cost cleanups in the same files:** log only the exception type around the TMDB create-session call (it carries a request token), one helper for the three background mail senders, and no local re-import of `settings` in `password_reset_request`.

Not changed (checked, by design): a new username inheriting failures recorded before it existed. Anyone can already lock any existing username for an hour with 20 bad attempts (the per-username limit's accepted cost), so pre-seeding a free name adds no new attack.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-security`: profile updates can't revert concurrent changes; verifying the current password doesn't change the stored hash; reconnect requirement gains "a session that couldn't be stored is revoked" and an atomic single-use token; a reset request covers every active account on the address; a successful login clears the failure count and ends earlier reset links; freeing a username by rename clears its count, like deletion.

## Impact

- Backend only: `backend/userdata/auth_views.py`, `serializers.py`, `tmdb_views.py`, plus tests in `test_account_security.py`, `test_tmdb_auth.py` and `test_account_input_2.py`.
- No API shape, migration, setting or dependency change. Login now writes `last_login` (one UPDATE per sign-in).
