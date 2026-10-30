## Context

Item 50's findings, checked against the code on 2026-10-30:

- `profile` (`auth_views.py`) sets attributes on `request.user`, which was loaded when the JWT was authenticated, then calls `user.save()` with no `update_fields`. Every column goes back, `password` included. `password_reset_confirm` already saves `update_fields=["password"]` for the mirror case.
- `UserProfileUpdateSerializer._require_current_password` calls `user.check_password()` once per gated field. Django's `check_password` passes a setter that re-hashes and saves (`update_fields=["password"]`, outside the view's transaction) when the hasher's parameters changed. The view snapshots `claim_before` and reissues tokens on success only; a failed PATCH returns 400 with the claim already changed.
- `tmdb_create_session`: `cache.get` then `cache.delete`, both requests can pass. After `create_session` succeeds, a `DBError` from `get_or_create`/`save` falls into the generic except, which returns 502 and logs `%s` of the exception. The new session is not revoked.
- `password_reset_request`: `User.objects.filter(email__iexact=email).first()`; no `is_active` or usable-password filter. Its send closure is the third copy of the try/`send_mail`/broad-except block (`_notify_email_changed`, `_notify_username_changed`).
- `login`: no failure clear, no `last_login` (simplejwt's `UPDATE_LAST_LOGIN` is off and the view is custom).

## Goals / Non-Goals

**Goals:** the seven confirmed findings; the three low cleanups in the same functions.

**Non-Goals:**
- Clearing failures when a username is registered. Locking a free name is no worse than locking a taken one, which the per-username limit already allows.
- Moving `current_password` out of the hand-parsed `request.data.get` pre-check. It is guarded by `isinstance`, only decides whether to consult the limit, and the serializer does the real parse.
- Removing `_login_failures`: tests use it.

## Decisions

1. **`update_fields` from the request.** The view already loops over `("first_name", "last_name", "username", "email")` and sets only keys present in `data`. Collect those names, add `"password"` when `new_password` is set, and `user.save(update_fields=fields)`. With nothing to change, skip the save. Alternative: `select_for_update` re-read of the user inside the transaction. More correct for field-level merges, but heavier; no other field is written concurrently except the password, which `update_fields` already protects.
2. **Verify without the upgrade setter.** In the serializer, `django.contrib.auth.hashers.check_password(raw, user.password)` (no `setter`) instead of `user.check_password(raw)`. Cache the boolean on the serializer so several gated fields verify once. The stored hash then changes only through `set_password`, so the view's `claim_before` snapshot and its "rehash only" reissue branch go away. The hash still upgrades at the next login, which keeps Django's setter. Alternative: keep the setter and reissue tokens on the error path too. That puts tokens in a 400 body and keeps the two-branch logic; rejected.
3. **Atomic single use: `cache.delete`'s return value.** Django's `cache.delete` returns whether it removed the key (LocMem and DatabaseCache both). Read the token, then proceed only if this request's `delete` returned `True`. Two concurrent requests can both `get`, but only one `delete` wins.
4. **Revoke an unstored session.** Split the try: TMDB errors (`RequestException`, `ValueError`, `KeyError`) as today; a `DBError` after `session_id` exists calls `tmdb_client.revoke_in_background(user_id, session_id)` and returns the same 502. Outside a transaction `on_commit` runs at once, which is what's wanted here. Both branches log `type(e).__name__` only.
5. **Reset fan-out.** `User.objects.filter(email__iexact=email, is_active=True)`, then skip users with `not has_usable_password()`, and mail each its own link (one `default_token_generator` token per user). Response unchanged. Mail goes through decision 6's helper, still off the request thread so timing reveals nothing.
6. **One mail helper.** `_mail_in_background(address, subject, message, what, user_pk)`: computes nothing, sends on `_in_background`, broad except with the existing justification, `logger.exception("Failed to send %s email to user %s", what, user_pk)`. The three call sites build their text and call it.
7. **Login success.** After `authenticate()` returns a user: `_clear_login_failures(failure_key)` and `update_last_login(None, user)` (Django's helper, `update_fields=["last_login"]`). `last_login` is part of the reset token hash, so earlier links die; this is Django's own behavior for `auth.login`.
8. **Rename clear joins the spec.** Already implemented in 0.31.0's `/simplify` pass; this change only adds its requirement and scenario.

## Risks / Trade-offs

- Clearing on success hands a guesser a fresh 19 tries each time the owner signs in. Owners sign in rarely enough that this stays far below what the limit allows per hour; and django-axes, the common reference, resets on success by default.
- A reset requested from an address shared by two accounts now sends two mails. Intended: each account can reset. Legacy duplicates only; registration enforces uniqueness.
- One extra UPDATE per login for `last_login`. Negligible next to the PBKDF2 check.
- A PATCH changing nothing (all keys equal) now skips the save; responses are the same.
