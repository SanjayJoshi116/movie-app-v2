import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

import requests
from django.db import transaction
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# api.tmdb.org is TMDB's official alternate API host. Some network paths reset
# roughly half of TLS handshakes to api.themoviedb.org (SNI-based filtering)
# while the alternate name gets through far more reliably.
TMDB_BASE = f"https://{os.getenv('TMDB_API_HOST', 'api.tmdb.org')}/3"

# Static fallback so a failed /genre/{type}/list call never surfaces a raw
# genre id to the user (e.g. "Your Taste: 18 & 10749" instead of names).
# TMDB genre ids are stable/rarely change, so this only goes stale if TMDB
# adds a brand-new genre.
STATIC_GENRE_NAMES = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy",
    36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery",
    10749: "Romance", 878: "Science Fiction", 10770: "TV Movie",
    53: "Thriller", 10752: "War", 37: "Western",
    10759: "Action & Adventure", 10762: "Kids", 10763: "News",
    10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
    10767: "Talk", 10768: "War & Politics",
}


# (connect, read) for every call. requests applies a scalar timeout to connect
# and to each read separately, so the old `timeout=10` meant ~20s per attempt.
TMDB_TIMEOUT = (3.05, 6)

# One session for every TMDB call (the proxy's and the backend's own): it pools
# connections instead of a fresh TLS handshake per call, and retries transient
# connection resets, which some network paths produce on a good share of
# handshakes. POST is retried on a read error too: a pooled connection TMDB
# already closed fails that way, and every write here is safe to resend (a
# rating POST sets a value, the DELETEs are idempotent, and create_session's
# request token is single use, so a resend can only fail). Background calls
# (recommendations, backfill) get the same retries with no deadline: a stall
# costs them more time, a reset no longer costs a refresh. A request-path
# call's wall-clock bound is its deadline (call_with_deadline), not these
# attempts: urllib3 tries the connect once per address DNS returns.
RETRY = Retry(
    total=2, connect=2, read=1, backoff_factor=0.5,
    allowed_methods=Retry.DEFAULT_ALLOWED_METHODS | {"POST"},
)
# Every thread that calls TMDB shares this pool: the proxy's and the deadline
# pool's 16 each, plus background work. Smaller, and urllib3 discards the extra
# connections, which brings the per-call handshake back under load.
# (test_startup_warmup pins it at least the request threads.)
SESSION_POOL_SIZE = 32
_session = requests.Session()
_session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=SESSION_POOL_SIZE, max_retries=RETRY))

# Wall-clock limit for one TMDB call made while a request waits (connect,
# token, rating sync). Per-attempt timeouts can't bound a call on their own:
# urllib3 tries the connect once per address DNS returns (api.tmdb.org has
# four), so the elapsed time depends on DNS. Endpoint budgets are calls x
# deadline, pinned under gunicorn's --timeout by the tests.
TMDB_CALL_DEADLINE = 10

# Only HTTP runs here (CLAUDE.md's worker-thread rule): an abandoned call can
# finish on its own after its deadline without touching the DB or the cache.
# Bounded, so an outage queues calls (which then fail at their deadline)
# instead of spawning threads without limit. Sized for gunicorn's 8 request
# threads per worker plus calls abandoned at their deadline still finishing
# (test_startup_warmup pins it against the entrypoint's --threads).
DEADLINE_POOL_SIZE = 16
_DEADLINE_POOL = ThreadPoolExecutor(max_workers=DEADLINE_POOL_SIZE, thread_name_prefix="tmdb-deadline")


class TMDBDeadlineExceeded(requests.Timeout):
    """A TMDB call ran past its wall-clock deadline. A requests.Timeout, so any
    `except requests.RequestException` already treats it as a failed call."""


def call_with_deadline(fn, deadline, *args, executor=None, **kwargs):
    """Run fn(*args, **kwargs) (a TMDB HTTP call) and give up after `deadline`
    seconds of elapsed time, every connect attempt and retry included. The
    proxy passes its own `executor`, so its abandoned calls can't fill the
    pool that rating sync, TMDB connect and Stats wait on."""
    future = (executor or _DEADLINE_POOL).submit(fn, *args, **kwargs)
    try:
        return future.result(timeout=deadline)
    except FutureTimeout:
        future.cancel()  # still queued: it never runs
        raise TMDBDeadlineExceeded(f"TMDB call exceeded its {deadline}s deadline") from None


def is_not_found(exc):
    """True when TMDB answered 404: the title or person doesn't exist (any
    more). That's a settled answer, not an outage, so callers store or return
    "nothing" for it instead of treating it as a failed fetch."""
    response = getattr(exc, "response", None)
    return isinstance(exc, requests.HTTPError) and response is not None and response.status_code == 404


def _request(method, path, params=None, json=None, timeout=TMDB_TIMEOUT):
    """One TMDB call through the shared session. Raises for an HTTP error, and
    ValueError for a body that isn't a JSON object (every TMDB v3 answer is
    one), so callers' existing ValueError handling covers a malformed reply."""
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    r = _session.request(method, f"{TMDB_BASE}{path}", params=p, json=json, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict):
        raise ValueError(f"TMDB answered {path} with a {type(data).__name__}, not an object")
    return data


def _get(path, params=None, timeout=TMDB_TIMEOUT):
    return _request("GET", path, params, timeout=timeout)


def discover(media_type, with_genres, page=1):
    """Discover movies or TV by a prepared `with_genres` value (this media
    type's own ids, from genre_families.with_genres). Returns raw result list."""
    params = {
        "with_genres": with_genres,
        "sort_by": "vote_average.desc",
        "vote_count.gte": 100 if media_type == "movie" else 50,
        "page": page,
    }
    data = _get(f"/discover/{media_type}", params)
    return data.get("results") or []


def get_details_with_cast(media_id, media_type):
    """Return {genre_ids, top_cast} for a movie or TV show."""
    if media_type == "movie":
        data = _get(f"/movie/{media_id}", {"append_to_response": "credits"})
        cast = [
            {"id": c["id"], "name": c["name"]}
            for c in ((data.get("credits") or {}).get("cast") or [])[:3]
        ]
    else:
        data = _get(f"/tv/{media_id}", {"append_to_response": "aggregate_credits"})
        cast = [
            {"id": c["id"], "name": c["name"]}
            for c in ((data.get("aggregate_credits") or {}).get("cast") or [])[:3]
        ]
    return {
        "genre_ids": [g["id"] for g in data.get("genres") or []],
        "top_cast": cast,
    }


def get_genre_names(media_type, timeout=TMDB_TIMEOUT, *, fallback=True):
    """Return {genre_id: name} map for movie or tv. Falls back to a static
    map on request failure so callers never get an empty result, unless
    `fallback` is off: then the failure is raised, for a caller that needs to
    know it got the static names (e.g. to cache them only briefly)."""
    try:
        data = _get(f"/genre/{media_type}/list", timeout=timeout)
        names = {
            g["id"]: g["name"]
            for g in data.get("genres") or []
            if isinstance(g, dict) and isinstance(g.get("id"), int) and g.get("name")
        }
        if not names:
            # A null, empty or all-malformed list: never hand back ids without names.
            raise ValueError(f"TMDB's {media_type} genre list had no usable entries")
        return names
    except (requests.RequestException, ValueError, KeyError, TypeError):
        if not fallback:
            raise
        return dict(STATIC_GENRE_NAMES)


def _post(path, body=None, params=None):
    return _request("POST", path, params, json=body or {})


def _delete(path, params=None, json=None):
    return _request("DELETE", path, params, json=json)


def revoke_tmdb_session(user_id, session_id):
    """Ask TMDB to delete a session (best-effort). Returns whether it succeeded.

    A failure is logged by exception type only: str(e) carries the request
    URL with the api_key, and the session id is a credential too.
    """
    try:
        _delete("/authentication/session", json={"session_id": session_id})
        return True
    except (requests.RequestException, ValueError) as e:
        logger.warning("TMDB session revoke failed for user %s (%s)", user_id, type(e).__name__)
        return False


def revoke_in_background(user_id, session_id):
    """Revoke a TMDB session after the current transaction commits, on a daemon
    thread, so no request waits on TMDB for it. Callers change the local state
    first (store the new session, clear the old one, delete the account): a
    request killed partway can then never leave a revoked session stored. The
    thread only does HTTP, and revoke_tmdb_session logs failures by type."""
    transaction.on_commit(lambda: _start_background(revoke_tmdb_session, user_id, session_id))


def _start_background(target, *args):
    """A daemon thread for HTTP-only work (tests run it inline)."""
    thread = threading.Thread(target=target, args=args, daemon=True)
    thread.start()
    return thread


def get_request_token():
    """Request a new TMDB authentication token."""
    return _get("/authentication/token/new")


def create_session(request_token):
    """Exchange an approved request token for a session_id."""
    return _post("/authentication/session/new", {"request_token": request_token})


def post_rating(media_type, media_id, session_id, value):
    """Post a rating (0.5-10) to TMDB for a movie or TV show."""
    return _post(
        f"/{media_type}/{media_id}/rating",
        {"value": value},
        {"session_id": session_id},
    )


def delete_rating(media_type, media_id, session_id):
    """Delete a rating from TMDB for a movie or TV show."""
    return _delete(
        f"/{media_type}/{media_id}/rating",
        {"session_id": session_id},
    )
