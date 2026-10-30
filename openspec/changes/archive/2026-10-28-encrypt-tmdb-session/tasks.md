## 1. Dependency and setting

- [x] 1.1 Pin `cryptography==43.0.3` in `backend/requirements.txt`; regenerate `backend/constraints.txt` per its header (fresh venv, `pip freeze`, restore header)
- [x] 1.2 `settings.py`: parse `TMDB_SESSION_KEYS` (comma-separated, stripped, empties dropped), validate each with `Fernet`; `ImproperlyConfigured` naming the variable when `DEBUG` is off and it's unset/empty/invalid; under `DEBUG` and unset, derive one key from `SECRET_KEY` (design decision 3)
- [x] 1.3 `backend/.env.example`: document `TMDB_SESSION_KEYS` (required with `DEBUG` off, first key encrypts, generator one-liner, rotation order)
- [x] 1.4 Tests in `test_app_config.py` (or its settings-reload helper): debug off + unset, blank, or an invalid item → error naming `TMDB_SESSION_KEYS` with no key value in it; debug on + unset → derived key works; a valid list loads

## 2. Encrypted field

- [x] 2.1 `userdata/secret_fields.py`: `EncryptedSessionField(TextField)` over a cached `MultiFernet` built from the setting; `""` passes through; `InvalidToken` on read → `""` + warning with the exception type only (decisions 2 and 4)
- [x] 2.2 `TMDBProfile.session_id` uses it; `makemigrations` (dev interpreter, `DEBUG=True`) for the `AlterField`
- [x] 2.3 Add the `RunPython` step to that migration over raw SQL: encrypt non-empty values that don't already decrypt; reverse decrypts (decision 6)
- [x] 2.4 Tests: stored column (raw SQL) differs from the session and decrypts to it; model and `values_list` reads return the plain session; `""` stays `""`; a value under a removed key reads `""` and logs no token text; rotation (new key first, old key kept) still reads old rows and writes new ones under the new key
- [x] 2.5 Migration test (`MigrationExecutor` or the project's migration-test pattern): a plain row is encrypted by the forward step, left alone on a second run, and decrypted by the reverse step

## 3. Behaviour unchanged for users

- [x] 3.1 Run the existing TMDB connect/status/disconnect, rating-sync and account-deletion tests unchanged; add one test: a profile whose stored value no key can read → status `connected: false`, a rating create returns 2xx with no TMDB call, connect again stores a readable session
- [x] 3.2 Management command `rotate_tmdb_sessions`: re-encrypt every non-empty row under the first key (`MultiFernet.rotate`), print the count; test it (decision 5)

## 4. Docs

- [x] 4.1 README Docker setup: `TMDB_SESSION_KEYS` in the `.env.docker` template with the generator command; **breaking** upgrade note; rotation steps (add key first, run `rotate_tmdb_sessions`, drop old key); keep the key list backed up apart from the database
- [x] 4.2 CLAUDE.md: session ids are encrypted at rest through `EncryptedSessionField` (never store a TMDB credential in a plain field); `TMDB_SESSION_KEYS` joins the fail-closed list. `docs/ARCHITECTURE.md`: rationale bullet (Fernet/MultiFernet, own key not `SECRET_KEY`, unreadable → disconnected)
- [x] 4.3 `docs/BUG_BACKLOG.md`: item 48's encryption part → 📝 `encrypt-tmdb-session`

## 5. Verify

- [x] 5.1 Backend `pytest`, `ruff check backend/`, `makemigrations --check --dry-run` (all with `DEBUG=True`)
- [x] 5.2 Dev DB: `migrate`, then confirm with raw SQL that a connected profile's column is a Fernet token and `/api/tmdb/status/` still reports connected for that user; `migrate userdata 0030` and back to check the reverse step on real data
- [x] 5.3 Note in the report that the Docker image build with the new wheel is checked only by CI's `docker` job
