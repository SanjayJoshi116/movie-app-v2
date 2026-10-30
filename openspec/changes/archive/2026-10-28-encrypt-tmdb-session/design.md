## Context

See proposal.md (Why). `TMDBProfile.session_id` is a `CharField(max_length=200, blank=True, default="")`. It is read in three places, all through the model: `ratings_views._tmdb_session_id` (rating sync), `tmdb_views` (connect stores a new one and revokes the old one in the background; status reports `bool(session_id)`; disconnect blanks it and revokes in the background), and `auth_views.delete_account` (`values_list("session_id")` before deleting the user, revoke after). An empty string means "not connected" everywhere. A TMDB session id is 32–40 hex characters.

`cryptography` 43.0.3 is present in the dev Conda env but isn't a declared dependency. `settings.py` already fails closed on missing production values (`SECRET_KEY`, `EMAIL_BACKEND`, `FRONTEND_URL`), and `test_app_config.py` requires every env var it reads to appear in `backend/.env.example`.

## Goals / Non-Goals

**Goals:**
- No usable session in the database without the key; callers unchanged.
- Rotation without forced reconnects; a lost key degrades to "reconnect", never a 500.

**Non-Goals:**
- Encrypting other columns (emails, usernames): not credentials.
- A KMS or per-user keys: one deployment-wide key list is proportionate here.
- Re-encrypting stored values under the newest key automatically (see Decision 5).

## Decisions

**1. Fernet via `MultiFernet`, from `cryptography`.**
Fernet is authenticated encryption (AES-128-CBC + HMAC-SHA256) with a versioned, timestamped token, and `MultiFernet` gives "first key encrypts, all keys decrypt" for rotation out of the box. Pin `cryptography==43.0.3` (the version already installed and tested in dev) in `requirements.txt` and regenerate `constraints.txt` the documented way.
*Alternative:* AES-GCM by hand. More code to get right for no gain here. *Alternative:* Django's `signing`. Signs, doesn't encrypt.

**2. A custom model field does the work: `EncryptedSessionField(models.TextField)`.**
In a new `userdata/secret_fields.py`: `get_prep_value` encrypts a non-empty string; `from_db_value` decrypts; `""` stays `""` both ways, so "not connected" checks and `default=""` keep working. Because Django applies `from_db_value` to `values_list` too, `delete_account` needs no change. `TextField`, because a Fernet token for a 40-character id is about 140 characters and the length is an implementation detail of the cipher.
*Alternative:* encrypt/decrypt helpers called at each site. Three call sites today and every future one must remember; a field can't be forgotten.

**3. Key setting `TMDB_SESSION_KEYS`, parsed and validated in `settings.py`.**
Comma-separated urlsafe-base64 Fernet keys, whitespace stripped, empty items dropped. With `DEBUG` off: unset, empty, or any item that `Fernet(key)` rejects raises `ImproperlyConfigured` naming `TMDB_SESSION_KEYS` (no key value in the message). With `DEBUG` on and unset: one key derived from `SECRET_KEY` (`urlsafe_b64encode(sha256(b"tmdb-session:" + SECRET_KEY))`), so `npm run dev` and pytest need nothing new. A set value is validated the same way under `DEBUG`. Document it in `backend/.env.example` with the one-line generator (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
*Why not derive from `SECRET_KEY` in production too:* rotating `SECRET_KEY` (e.g. after a leak) would silently disconnect everyone, and one leaked value would expose both signing and sessions.

**4. Undecryptable value → `""` plus a warning with the exception type only.**
`from_db_value` catches `InvalidToken` and returns `""`. Callers already treat `""` as "not connected": status reports false, rating sync skips TMDB, connect overwrites it with a fresh encrypted session. The log line carries the class name and nothing from the token. A plain-text value that slipped past the migration also fails to decrypt and reads as disconnected, which is the safe direction.

**5. No automatic re-encryption on rotation.**
`MultiFernet.rotate` exists, but rewriting rows on read turns every GET into a write. Rotation procedure (README): add the new key first, keep the old ones; optionally run a small management command `rotate_tmdb_sessions` that re-encrypts every row under the first key; then drop the old key. The command is a dozen lines and makes "drop the old key" safe to do on purpose.

**6. Migration: `AlterField` to the new field, then `RunPython` over raw SQL.**
The historical model in `RunPython` would use the new field class and try to decrypt plain text, so the data step reads and writes through `schema_editor.connection.cursor()` instead: for each non-empty value, skip it if it already decrypts (re-running is safe), else write `MultiFernet.encrypt`. The reverse step decrypts back to plain text, so `migrate userdata <previous>` restores the old state. The key comes from settings at migrate time; Docker's entrypoint runs `migrate` with the same environment as gunicorn.

## Risks / Trade-offs

- [Deploy without the setting → backend won't start] → Fail-closed is the intent (same as `FRONTEND_URL`). README upgrade note marked breaking, with the generator command; the error message names the variable.
- [All keys lost → every TMDB user disconnected] → Degrades to "reconnect TMDB", no data lost (ratings are local). README says to back the key list up with the database credentials, not with the database.
- [Key and database leak together] → Out of scope; this protects dumps and backups, the common case.
- [`cryptography` wheel in the Docker image] → manylinux wheels exist for the image's Python; CI's `docker` job builds it. Not checkable locally (no Docker).

## Migration Plan

1. Set `TMDB_SESSION_KEYS` in `.env.docker` (production) before deploying.
2. Deploy: the entrypoint's `migrate` alters the column and encrypts existing rows.
3. Rollback: `migrate userdata <previous>` decrypts back to plain text, then deploy the previous image.
