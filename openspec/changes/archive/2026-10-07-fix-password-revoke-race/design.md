## Context

See proposal.md (Why). The race:

```
 Device A (password change)               Device B (holds refresh R1)
 save new password                        POST /auth/token/refresh/ {R1}
 live = Outstanding(user, !blacklisted)     ├ R1 blacklisted? no ✔   (before A's snapshot)
 bulk-create Blacklisted(live)  ← {R1}     ├ blacklist R1 (dup, ignored)
                                           └ outstand R2             (after A's snapshot)
                                           → R2 never revoked, rotates indefinitely
```

simplejwt 5.5.1, pinned in `requirements.txt`, already ships the pieces:
- `CHECK_REVOKE_TOKEN` (default False) makes `Token.for_user()` stamp `REVOKE_TOKEN_CLAIM` (`"hash_password"`) = `md5(user.password).upper()`. `user.password` here is the stored hash string, not the plaintext.
- `RefreshToken.access_token` copies every claim except `no_copy_claims`, and rotation in `TokenRefreshSerializer.validate()` keeps the payload and resets only `jti`/`exp`/`iat`. So the claim survives rotation and reaches every access token.
- `JWTAuthentication.get_user()` compares the claim with the current hash when `CHECK_REVOKE_TOKEN` is on, and raises `AuthenticationFailed` (401) on a mismatch or a missing claim.
- `TokenRefreshSerializer.validate()` does **not** check the claim. That gap is what lets R2 keep rotating.

All app token issuance goes through `_tokens_for_user()` → `RefreshToken.for_user()`, used by login, register and the profile password change, plus rotation in the refresh view.

## Goals / Non-Goals

**Goals:** close the race by construction instead of narrowing the timing, and end other sessions' access tokens at password-change time.

**Non-Goals:**
- A grace period for tokens without the claim. Hard logout was decided on 2026-10-07.
- Revoking on email or username change. That's not a credential change.
- Shortening `ACCESS_TOKEN_LIFETIME`.
- Scheduling `flushexpiredtokens`.

## Decisions

1. **Use the built-in claim, not a custom HMAC claim.** One setting, upstream-maintained, and already enforced for access tokens.
   - *Trade-off:* the claim is an unkeyed MD5 of the stored password hash, and anyone who holds the token can read it. The stored hash is salted PBKDF2, so the MD5 doesn't help an offline guess without the salt and hash themselves. Only the token's own holder sees it.
   - *Alternative:* `salted_hmac` of the password (like `get_session_auth_hash`) in a custom claim. That needs a custom `RefreshToken` subclass plus its own access check. Rejected as more code for no practical gain.
2. **Add the check to `SafeTokenRefreshSerializer.validate()`.** Before calling `super().validate()`, decode the token, load the user, and raise `InvalidToken` when `payload.get(REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password)`. The existing `User.DoesNotExist` → `InvalidToken` handling stays.
   - Checking before `super()` means a stale token is rejected without being rotated or recorded.
   - It costs one extra user lookup per refresh, which is acceptable (refreshes are hourly at most).
   - *Alternative:* locking the user row in both revoke and refresh. Rejected: it means wrapping simplejwt internals, and every new revoke path must remember to lock.
3. **Keep `_revoke_all_refresh_tokens()`.** The claim makes it redundant for security. It still marks those tokens blacklisted in the DB, which keeps the logout and blacklist semantics consistent and makes revoked sessions visible in admin.
4. **Missing claim = reject (hard logout).** Pre-deploy tokens fail both checks, so each signed-in user goes through the existing 401 → refresh (rejected) → `/login` path once.

## Risks / Trade-offs

- [Every user is logged out once at deploy] → Accepted. Note it in the release notes or version bump.
- [Rotating `SECRET_KEY` doesn't affect this claim, and a password change doesn't affect signing] → Independent mechanisms, as intended.
- [An admin `set_password` or any future password path now revokes too] → That's desired. It works through the claim with no extra code.
- [The current session's own in-flight requests carry the old access token when the profile PATCH returns] → They 401. The interceptor sees the stored token differs from the failed request's header (the new pair is already stored) and replays with the current token, per the existing late-401 logic. Verify this in e2e or manually.
- [A test relies on `force_authenticate` and never exercises the claim] → New tests build real tokens through `_tokens_for_user()` and hit endpoints with `HTTP_AUTHORIZATION`.

## Migration Plan

Deploy as normal. No DB migration. Rollback: set `CHECK_REVOKE_TOKEN` back to False and remove the serializer check. Tokens issued in the meantime carry an extra claim that is simply ignored.
