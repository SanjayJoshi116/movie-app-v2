## 1. Username change

- [x] 1.1 `UserProfileUpdateSerializer.validate`: a changed username (exact compare) requires the current password
- [x] 1.2 `auth_views.profile`: `_notify_username_changed` to the address on file before the update, on commit, off the request thread; no email → no notice
- [x] 1.3 pytest: rename without / with wrong (counts toward the limit) / with correct password; unchanged username resubmitted needs none; notice sent to the old address after commit; mail failure doesn't fail the rename; account without email gets no notice

## 2. Password similarity

- [x] 2.1 `settings.AUTH_PASSWORD_VALIDATORS`: add `UserAttributeSimilarityValidator` first
- [x] 2.2 `RegisterSerializer`: validate the password at object level against an unsaved `User(username, email)`, errors under `password`
- [x] 2.3 Profile: validate a new password against an unsaved copy carrying the update's username, email and names
- [x] 2.4 pytest: register `alice`/`alice2024` rejected (`alicealice` pinned as accepted under Django's default threshold) (no account); profile change to an email-like password rejected (old one still works); reset to username+digits rejected (link still usable)

## 3. Failure key

- [x] 3.1 `_login_failure_key`: hash the exact username
- [x] 3.2 pytest: `Alice` limited, `alice` still signs in

## 4. Frontend

- [x] 4.1 `ProfileModal.tsx`: send `current_password` when the username changes; hint "Required to change username, email or password"
- [x] 4.2 Python e2e `test_profile.py` (it already checks the sent payload; no ProfileModal Jest harness exists): a rename sends the current password; a first-name-only edit doesn't (existing test)

## 5. Verify

- [x] 5.1 Backend pytest, `ruff check backend/`
- [x] 5.2 Typecheck, lint, Jest
- [x] 5.3 e2e touching register and profile (`auth.spec.ts`, Python `test_auth.py`, `test_profile.py`)

## 6. Docs

- [x] 6.1 CLAUDE.md (password-gated actions: username change; similarity validator; exact-username failure key)
- [x] 6.2 `docs/BUG_BACKLOG.md`: item 39 → 📝 proposed, linked
