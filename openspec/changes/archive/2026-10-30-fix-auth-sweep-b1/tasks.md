## 1. Profile update (decisions 1, 2)

- [x] 1.1 `UserProfileUpdateSerializer`: verify `current_password` with `hashers.check_password(raw, user.password)` (no setter), cached on the serializer so several gated fields check once
- [x] 1.2 `profile` view: save with `update_fields` = edited fields present in `data` (+ `"password"` with `new_password`), skip the save when empty; drop `claim_before` and the rehash-only reissue branch
- [x] 1.3 Tests: a reset committed between authentication and save keeps the new password (old one refused); with a changed hasher iteration count, a failing PATCH with the right password leaves the stored hash and the session's tokens valid; email + username + password change verifies once (patched counter)

## 2. TMDB connect (decisions 3, 4)

- [x] 2.1 `tmdb_create_session`: proceed only if `cache.delete(key)` returned `True` after the read
- [x] 2.2 Split the except: TMDB errors as today; a `DBError` after TMDB issued the session revokes it via `revoke_in_background` and returns the same 502; both log the exception type only
- [x] 2.3 Tests: second submit after a won delete gets 400 with no TMDB call; failing `profile.save()` revokes the new session, keeps the old one stored and unrevoked, 502; no session or token text in the log

## 3. Password reset request and mail (decisions 5, 6)

- [x] 3.1 `_mail_in_background(address, subject, message, what, user_pk)`; `_notify_email_changed`, `_notify_username_changed` and the reset request use it; drop the local `settings` re-import
- [x] 3.2 Reset request: one link per active account with a usable password on the address; response unchanged
- [x] 3.3 Tests: two accounts sharing an address each get a mail whose link resets that account; inactive and unusable-password accounts get none; same response body for zero, one, two matches

## 4. Login success (decision 7)

- [x] 4.1 `login`: on success clear the username's failure count and `update_last_login(None, user)`
- [x] 4.2 Tests: 19 failures then a success, then one failure → not limited; a reset link mailed before a sign-in is rejected after it; a limited login (429) clears nothing

## 5. Rename (decision 8)

- [x] 5.1 Confirm `test_rename_frees_the_old_name_without_its_failures` covers the new scenario; nothing else to build

## 6. Docs and verify

- [x] 6.1 `docs/BUG_BACKLOG.md` item 50: per-finding verdicts (7 confirmed, 1 by design, cleanups) and 📝 `fix-auth-sweep-b1`; `CLAUDE.md` throttle bullet: a successful sign-in clears the count; profile updates save only edited fields
- [x] 6.2 Backend `pytest`, `ruff check backend/`, `makemigrations --check --dry-run` (all with `DEBUG=True`)
