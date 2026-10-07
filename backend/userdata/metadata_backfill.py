"""Fill per-entry TMDB metadata (genres, original language, release year) on
WatchedEntry rows.

One path for stats (fire-and-forget, `request_backfill`) and personalized
recommendations (synchronous, `backfill_entries`). Before this, genres were only
filled inside `_compute_personalized` (which skips users with <3 titles), and
`/stats` started its own 20-worker thread on every request with no dedupe and
retried failed rows forever.

Retry state is in-process, like recommendations' `_computing_users`: a restart
or another gunicorn worker costs at most one extra fetch per title.
"""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from django.db import Error as DBError
from django.db import connection

from . import tmdb_client
from .models import WatchedEntry

logger = logging.getLogger(__name__)

MAX_WORKERS = 5
BACKOFF_SECONDS = 60 * 60
UNKNOWN_LANGUAGE = "??"
UNKNOWN_YEAR = -1

_lock = threading.Lock()
_running = set()  # user ids with a backfill thread in flight
_failed_at = {}  # entry pk -> monotonic time of the last transient failure
# Entry pks whose fetch settled with no genres (TMDB 404, or a title TMDB has
# no genres for). An empty genre_ids list otherwise reads as "not filled yet".
_settled = set()


def entry_needs_metadata(entry):
    if entry.pk in _settled:
        return entry.original_language is None or entry.release_year is None
    return not entry.genre_ids or entry.original_language is None or entry.release_year is None


def _in_backoff(entry):
    failed = _failed_at.get(entry.pk)
    return failed is not None and time.monotonic() - failed < BACKOFF_SECONDS


def fetch_entry_metadata(entry):
    """Fetch one entry's metadata from TMDB (no DB access, safe in a worker thread).

    Returns `(fields, settled)` to store, or None on a transient failure (the
    entry is then put in backoff).
    """
    try:
        data = tmdb_client._get(f"/{entry.media_type}/{entry.media_id}")
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            return {"genre_ids": [], "original_language": UNKNOWN_LANGUAGE, "release_year": UNKNOWN_YEAR}, True
        logger.warning("Metadata fetch failed for WatchedEntry %s: %s", entry.pk, e)
        _failed_at[entry.pk] = time.monotonic()
        return None
    except (requests.RequestException, ValueError) as e:
        logger.warning("Metadata fetch failed for WatchedEntry %s: %s", entry.pk, e)
        _failed_at[entry.pk] = time.monotonic()
        return None

    date_str = data.get("release_date" if entry.media_type == "movie" else "first_air_date") or ""
    try:
        year = int(date_str[:4]) if len(date_str) >= 4 else UNKNOWN_YEAR
    except ValueError:
        year = UNKNOWN_YEAR
    genre_ids = [g["id"] for g in data.get("genres", []) if isinstance(g, dict) and "id" in g]
    fields = {
        "genre_ids": genre_ids,
        "original_language": data.get("original_language") or UNKNOWN_LANGUAGE,
        "release_year": year,
    }
    return fields, not genre_ids


def _store(entry, fields, settled):
    try:
        WatchedEntry.objects.filter(pk=entry.pk).update(**fields)
    except DBError:
        logger.exception("Failed to store metadata for WatchedEntry %s", entry.pk)
        _failed_at[entry.pk] = time.monotonic()
        return
    for name, value in fields.items():
        setattr(entry, name, value)
    _failed_at.pop(entry.pk, None)
    if settled:
        _settled.add(entry.pk)


def backfill_entries(entries):
    """Synchronously fill every entry that needs metadata and isn't in backoff.

    TMDB fetches run in a small pool; DB writes stay on the calling thread so
    the workers never open (and leak) their own DB connections. Entries are
    updated in place.
    """
    todo = [e for e in entries if entry_needs_metadata(e) and not _in_backoff(e)]
    if not todo:
        return
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        results = list(ex.map(fetch_entry_metadata, todo))
    for entry, result in zip(todo, results, strict=True):
        if result is not None:
            _store(entry, *result)


def _run_backfill(user_id):
    try:
        backfill_entries(list(WatchedEntry.objects.filter(user_id=user_id)))
    except DBError:
        logger.exception("Metadata backfill failed to load entries for user %s", user_id)
    finally:
        connection.close()  # this thread's own connection
        with _lock:
            _running.discard(user_id)


def request_backfill(user_id):
    """Start a background backfill for user_id unless one is already running."""
    with _lock:
        if user_id in _running:
            return
        _running.add(user_id)
    threading.Thread(target=_run_backfill, args=(user_id,), daemon=True).start()
