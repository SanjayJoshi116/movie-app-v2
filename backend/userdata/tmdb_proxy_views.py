import logging

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings
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


class TmdbProxyThrottle(UserRateThrottle):
    scope = "tmdb_proxy"


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([TmdbProxyThrottle])
def tmdb_proxy(request, tmdb_path):
    # .dict() kept only the last value of a repeated param; forward them all, in
    # order, and never let a client-supplied api_key through.
    params = [(k, v) for k, values in request.GET.lists() if k != "api_key" for v in values]
    params.append(("api_key", settings.TMDB_API_KEY))
    try:
        r = _session.get(f"{TMDB_BASE}/{tmdb_path}", params=params, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))
        return Response(r.json(), status=r.status_code)
    except (requests.RequestException, ValueError):
        logger.exception("tmdb_proxy request failed for path %s", tmdb_path)
        return Response({"error": "TMDB request failed."}, status=502)
