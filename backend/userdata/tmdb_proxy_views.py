import hashlib
import logging
import re
from urllib.parse import urlencode

from concurrent.futures import ThreadPoolExecutor

import requests
from django.conf import settings
from django.core.cache import caches
from django.db import Error as DatabaseError
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

# The backend's one TMDB session (pooled connections, transient-reset retries):
# a detail page fires ~6 proxy calls at once, which saw sporadic connection
# errors with a bare per-call requests.get().
from .tmdb_client import TMDB_BASE, TMDB_TIMEOUT, _session, call_with_deadline

logger = logging.getLogger(__name__)

# Time budget: the whole call runs under a wall-clock deadline
# (tmdb_client.call_with_deadline), because per-attempt timeouts can't bound it
# (urllib3 tries the connect once per address DNS returns). test_tmdb_proxy
# pins PROXY_DEADLINE_SECONDS under gunicorn's --timeout.
PROXY_DEADLINE_SECONDS = 20

# The proxy's own deadline pool: a call abandoned at its deadline keeps its
# thread until it ends, which while TMDB stalls can be well past the deadline.
# On the shared pool those would starve rating sync, TMDB connect and Stats.
# Sized for gunicorn's request threads (test_startup_warmup pins it).
PROXY_POOL_SIZE = 16
PROXY_POOL = ThreadPoolExecutor(max_workers=PROXY_POOL_SIZE, thread_name_prefix="tmdb-proxy")

# Plain TMDB paths only: letters, digits, _ and - between single slashes. The
# cache and credential checks read this string, while requests/urllib3 would
# turn a decoded "?" into the query and collapse ".." segments, so anything
# else could reach TMDB as something the checks never saw.
_TMDB_PATH = re.compile(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*")

# Response cache (the `tmdb` alias in settings.CACHES). TMDB data is public, so
# one user's response can serve another. Lifetimes follow how often each kind of
# resource changes; anything not matched is a title/person/season detail.
LIST_TTL = 10 * 60
STATIC_TTL = 24 * 60 * 60
DETAIL_TTL = 6 * 60 * 60
_LIST_PATH = re.compile(
    r"^(?:(?:trending|discover|search)/"
    r"|(?:movie|tv|person)/(?:popular|now_playing|upcoming|top_rated|airing_today|on_the_air)$)"
)
_STATIC_PATH = re.compile(r"^(?:genre/|configuration)")
# Per-user TMDB data must never be cached or shared between users.
_CREDENTIAL_PARAMS = {"session_id", "guest_session_id"}
_UNCACHEABLE_PATH = re.compile(r"^(?:account|authentication)(?:/|$)")


def cache_ttl(tmdb_path):
    if _LIST_PATH.match(tmdb_path):
        return LIST_TTL
    if _STATIC_PATH.match(tmdb_path):
        return STATIC_TTL
    return DETAIL_TTL


def _cache_key(tmdb_path, params):
    """What goes upstream (minus the API key), with the params sorted so the
    same request in another order is the same entry."""
    raw = tmdb_path + "?" + urlencode(sorted(params))
    return "tmdbproxy:" + hashlib.sha256(raw.encode()).hexdigest()


def _cacheable(tmdb_path, params):
    return not _UNCACHEABLE_PATH.match(tmdb_path) and not any(k in _CREDENTIAL_PARAMS for k, _ in params)


def _cache_get(key):
    try:
        return caches["tmdb"].get(key)
    except DatabaseError:
        # A cache-table problem must never fail the request; fetch upstream.
        logger.warning("tmdb proxy cache read failed", exc_info=True)
        return None


def _cache_set(key, data, ttl):
    try:
        caches["tmdb"].set(key, data, ttl)
    except DatabaseError:
        logger.warning("tmdb proxy cache write failed", exc_info=True)


class TmdbProxyThrottle(UserRateThrottle):
    scope = "tmdb_proxy"


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([TmdbProxyThrottle])
def tmdb_proxy(request, tmdb_path):
    if not _TMDB_PATH.fullmatch(tmdb_path):
        return Response({"error": "Invalid TMDB path."}, status=400)
    # .dict() kept only the last value of a repeated param; forward them all, in
    # order, and never let a client-supplied api_key through.
    params = [(k, v) for k, values in request.GET.lists() if k != "api_key" for v in values]
    # Throttling runs before this view, so a cache hit still counts.
    key = _cache_key(tmdb_path, params) if _cacheable(tmdb_path, params) else None
    if key:
        cached = _cache_get(key)
        if cached is not None:
            return Response(cached, headers={"X-Cache": "HIT"})
    def fetch():
        r = _session.get(
            f"{TMDB_BASE}/{tmdb_path}",
            params=[*params, ("api_key", settings.TMDB_API_KEY)],
            timeout=TMDB_TIMEOUT,
        )
        return r, r.json()

    try:
        # A deadline overrun is a requests.Timeout, so it lands in the 502 below.
        r, data = call_with_deadline(fetch, PROXY_DEADLINE_SECONDS, executor=PROXY_POOL)
    except (requests.RequestException, ValueError):
        logger.exception("tmdb_proxy request failed for path %s", tmdb_path)
        return Response({"error": "TMDB request failed."}, status=502)
    if r.status_code in (401, 403):
        # TMDB refused the server's own key: a server fault, never the client's
        # sign-in (the frontend reads a 401 as its own token expiring).
        logger.warning("tmdb_proxy: TMDB refused the server key (%s) for path %s", r.status_code, tmdb_path)
        return Response({"error": "TMDB request failed."}, status=502)
    headers = {"X-Cache": "MISS" if key else "BYPASS"}
    retry_after = r.headers.get("Retry-After") if r.status_code == 429 else None
    if isinstance(retry_after, str):
        headers["Retry-After"] = retry_after  # so a client can wait out TMDB's limit
    # Only successes are kept: an error or a rate-limit answer is retried next time.
    if key and r.status_code == 200:
        _cache_set(key, data, cache_ttl(tmdb_path))
    return Response(data, status=r.status_code, headers=headers)
