## 1. Password-bound tokens

- [x] 1.1 Set `"CHECK_REVOKE_TOKEN": True` in `SIMPLE_JWT` (`backend/cinedb/settings.py`). Keep `REVOKE_TOKEN_CLAIM` at its default.
- [x] 1.2 In `SafeTokenRefreshSerializer.validate()` (`auth_views.py`), before `super().validate()`: decode the refresh token, load its user, and raise `InvalidToken` when the claim is missing or doesn't equal `get_md5_hash_password(user.password)`. Keep the `User.DoesNotExist` → `InvalidToken` path.
- [x] 1.3 Leave `_revoke_all_refresh_tokens()` and its call sites unchanged. Update its docstring to say the claim is now the primary guard.

## 2. Tests

- [x] 2.1 Race reproduction: issue R1, mint R2 by rotating R1 through the serializer, stub or interleave so that the revoke snapshot misses R2, then change the password. Refreshing with R2 → 401, and R2's access token on an authenticated endpoint → 401.
- [x] 2.2 Profile password change: the returned pair works for both refresh and API calls, and another device's pre-change access token → 401 right away.
- [x] 2.3 Password reset confirm: all pre-reset refresh and access tokens → 401.
- [x] 2.4 A token without `hash_password` (built with `CHECK_REVOKE_TOKEN` off) → 401 on refresh and on API access.
- [x] 2.5 Name-only profile edit: existing tokens keep working.
- [x] 2.6 Existing `SafeTokenRefreshView` deleted-user test still returns 401.
- [x] 2.7 Run `pytest`, `ruff check backend/` and `makemigrations --check --dry-run`. All must pass.

## 3. Frontend check

- [x] 3.1 Under `npm run dev`, change the password from the profile dialog with two tabs open in one browser and a second browser signed in. The first browser stays signed in and the second is sent to `/login` on its next request. Check that no unexpected logout happens in the browser that made the change (late-401 replay path).

## 4. Docs

- [x] 4.1 `docs/ARCHITECTURE.md`: update the "Revoke-all on credential change" bullet. Password-bound claim checked on refresh and access, other sessions' access tokens end immediately, one-time logout at rollout.
- [x] 4.2 `CLAUDE.md`: add to the token-refresh convention that `SafeTokenRefreshSerializer` also enforces the `hash_password` claim. Don't swap it for the stock serializer, and don't turn `CHECK_REVOKE_TOKEN` off.
