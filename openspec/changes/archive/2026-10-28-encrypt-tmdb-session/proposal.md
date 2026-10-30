## Why

A connected user's TMDB `session_id` can rate titles, delete ratings and edit lists on their TMDB account, and it sits in the `TMDBProfile` table as plain text. Anyone with a database dump, a backup or read access to Postgres gets working sessions for every connected user. The code already treats these values as secrets in logs (`RedactingFormatter`); the database is the one place they aren't protected. Split out of backlog item 48 (`fix-db-layer`).

## What Changes

- `TMDBProfile.session_id` is stored encrypted (Fernet, from the `cryptography` package) and decrypted on read, transparently to the views that use it.
- New setting `TMDB_SESSION_KEYS`: a comma-separated list of Fernet keys. The first encrypts; every key in the list can decrypt, so a key can be rotated without disconnecting anyone. With `DEBUG` off the backend refuses to start without a valid list; under `DEBUG` (and pytest) it falls back to a key derived from `SECRET_KEY`.
- A stored value no configured key can decrypt (a key removed too early) reads as "not connected" and is logged by type only, never as a 500. The user reconnects.
- A data migration encrypts every existing plain-text value in place, so connected users stay connected. It is reversible (decrypts back).
- `cryptography` becomes a pinned direct dependency (`requirements.txt`, regenerated `constraints.txt`).
- **BREAKING (deploy):** a production deploy must set `TMDB_SESSION_KEYS` before upgrading, or the backend won't start.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-security`: TMDB sessions are stored encrypted at rest; keys can be rotated; an unreadable stored session reads as disconnected.
- `api-hardening`: "Production configuration fails closed" also requires a valid `TMDB_SESSION_KEYS`.

## Impact

- Backend: `backend/userdata/models.py` (field type), a new module for the encrypted field, one migration (field change + data migration), `backend/cinedb/settings.py`, `backend/.env.example`, `requirements.txt`, `constraints.txt`, tests.
- No API or frontend change: `/api/tmdb/status/` and rating sync behave the same.
- Docs: README Docker setup and an upgrade note, CLAUDE.md (secrets/settings conventions), `docs/ARCHITECTURE.md` rationale, backlog item 48.
- Operations: each deployment generates and keeps its own key list; losing all keys disconnects every TMDB user (they reconnect).
