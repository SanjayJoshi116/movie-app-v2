import hashlib
import logging
import re
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings
from django.core.cache import caches
from django.db import Error as DatabaseError
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .tmdb_client import TMDB_BASE

logger = logging.getLogger(__name__)

# Shared session: pools/reuses connections instead of a fresh TLS handshake
# per call, and retries transient connection resets — movie detail pages
# fire ~6 concurrent proxy requests, which was seeing sporadic connection
# errors under that burst with a bare per-call requests.get().
#
# Time budget: gunicorn's sync workers are killed after --timeout (30s,
# docker-entrypoint.sh), which turns into a bare nginx 502 and a lost worker.
# The old 20s timeout x 5 attempts could hold a worker ~100s, so connect
# retries (cheap, the reset case above) are kept and read retries cut;
# test_tmdb_proxy enforces WORST_CASE_SECONDS against the gunicorn timeout.
CONNECT_TIMEOUT = 3.05
READ_TIMEOUT = 6
RETRY = Retry(total=2, connect=2, read=1, backoff_factor=0.5)


def _worst_case_seconds(retry, connect_timeout, read_timeout):
    """Upper bound for one proxied call, retries and backoff included.

    Only read+1 attempts can get as far as reading (urllib3 classifies errors
    while reading as read errors); the rest fail during connect. Backoff is
    urllib3's: none before the first retry, then factor * 2**(n-1). requests'
    read timeout is per socket read, so a server trickling bytes isn't bounded
    by this — that's not the failure mode seen from TMDB.
    """
    reading = retry.read + 1
    connect_only = retry.total - retry.read
    backoff = sum(retry.backoff_factor * 2 ** (n - 1) for n in range(2, retry.total + 1))
    return reading * (connect_timeout + read_timeout) + connect_only * connect_timeout + backoff


WORST_CASE_SECONDS = _worst_case_seconds(RETRY, CONNECT_TIMEOUT, READ_TIMEOUT)

_session = requests.Session()
_session.mount("https://", HTTPAdapter(max_retries=RETRY))

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
    """Exactly what goes upstream (minus the API key), in the order received."""
    raw = tmdb_path + "?" + urlencode(params)
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
    # .dict() kept only the last value of a repeated param; forward them all, in
    # order, and never let a client-supplied api_key through.
    params = [(k, v) for k, values in request.GET.lists() if k != "api_key" for v in values]
    # Throttling runs before this view, so a cache hit still counts.
    key = _cache_key(tmdb_path, params) if _cacheable(tmdb_path, params) else None
    if key:
        cached = _cache_get(key)
        if cached is not None:
            return Response(cached, headers={"X-Cache": "HIT"})
    try:
        r = _session.get(
            f"{TMDB_BASE}/{tmdb_path}",
            params=[*params, ("api_key", settings.TMDB_API_KEY)],
            timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
        )
        data = r.json()
    except (requests.RequestException, ValueError):
        logger.exception("tmdb_proxy request failed for path %s", tmdb_path)
        return Response({"error": "TMDB request failed."}, status=502)
    # Only successes are kept: an error or a rate-limit answer is retried next time.
    if key and r.status_code == 200:
        _cache_set(key, data, cache_ttl(tmdb_path))
    return Response(data, status=r.status_code, headers={"X-Cache": "MISS" if key else "BYPASS"})
