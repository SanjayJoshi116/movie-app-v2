## Why

Backlog item 27 (also the open urllib3 note left from item 17): every TMDB call made while a request is waiting can outlive gunicorn's 30-second worker timeout. The TMDB proxy's time budget doesn't count that urllib3 tries the connect once per resolved address (`api.tmdb.org` has four), so its real worst case is about 37 s, not 22 s. `tmdb_client`'s calls use a scalar `timeout=10`, which `requests` applies to connect and read separately, and they have no overall limit at all. When a worker is killed mid-request, the damage depends on what had already happened:
- a rating is saved but the client gets a 502;
- an account deletion stops after revoking the TMDB session, so the account isn't deleted;
- a TMDB reconnect revokes the old session but never stores the new one, leaving a dead session that every later rating sync fails on.

CLAUDE.md requires a budget and a pin test for every endpoint that waits on TMDB, and these have none.

## What Changes

- **Every TMDB call made while a request waits has a wall-clock deadline.** One deadline helper in `tmdb_client` bounds the whole call, every connect attempt included, whatever DNS returns. The proxy, the TMDB connect endpoints, the rating endpoints' sync and Stats' genre lookup use it. Each has a budget constant and a test that pins it under gunicorn's timeout.
- **Rating sync to TMDB happens after the local save and is bounded.** Creating, re-scoring or deleting a rating saves locally first, then syncs to TMDB within the deadline. A slow TMDB delays the response by at most the deadline and never fails it, and a killed worker can no longer turn a saved rating into a 502. The sync stays in the request (not in the background) so changes keep reaching TMDB in order: background syncs on different server processes could arrive out of order, and background threads may not read the database to check.
- **Account deletion deletes first, then revokes.** The account is deleted, and the TMDB session revoke runs afterwards in the background (best-effort, logged on failure). A slow TMDB can't stop the deletion.
- **Connecting and disconnecting TMDB store first, then revoke.** A reconnect saves the new session before revoking the old one. A disconnect clears the stored session before revoking it. Either revoke runs in the background, so a killed request can't leave a revoked session stored.
- **Connecting a TMDB account answers within its budget**: the request-token and create-session calls are each bounded by the deadline.
- `tmdb_client`'s calls use a `(connect, read)` timeout tuple instead of a scalar.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `api-hardening`: the TMDB proxy's bound holds however many addresses TMDB's host resolves to (a wall-clock deadline, not a model of retries).
- `endpoint-time-budgets`: Stats' genre lookup is bounded by the same deadline; TMDB connect endpoints respond within a bounded time.
- `ratings`: TMDB sync happens after the local change is saved, within a bounded time, and in the order the changes were made.
- `account-security`: disconnect, reconnect and account deletion change the local state first and revoke the TMDB session afterwards in the background.

## Impact

- Backend:
  - TMDB calls and their callers: `userdata/tmdb_client.py` (deadline helper, timeout tuple), `userdata/tmdb_proxy_views.py`, `userdata/tmdb_views.py`, `userdata/stats_views.py`
  - Background revoke and rating sync: `userdata/ratings_views.py`, `userdata/auth_views.py` (`delete_account`)
- Tests: budget pins for the proxy, the TMDB connect endpoints and Stats; ordering tests for rating sync and session revoke; a test with a stalled connect on several addresses.
- No API or frontend change. Response codes and bodies stay the same, and only timing and ordering change.
- Docs: CLAUDE.md (the TMDB budget rule names the deadline helper; background TMDB writes), `docs/ARCHITECTURE.md` (why a deadline instead of a retry model), CHANGELOG, `docs/BUG_BACKLOG.md`.
