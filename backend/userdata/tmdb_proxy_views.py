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
_session = requests.Session()
_session.mount(
    "https://",
    HTTPAdapter(max_retries=Retry(total=2, backoff_factor=0.3, connect=2, read=2)),
)


class TmdbProxyThrottle(UserRateThrottle):
    scope = "tmdb_proxy"


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([TmdbProxyThrottle])
def tmdb_proxy(request, tmdb_path):
    params = {**request.GET.dict(), "api_key": settings.TMDB_API_KEY}
    try:
        r = _session.get(f"{TMDB_BASE}/{tmdb_path}", params=params, timeout=20)
        return Response(r.json(), status=r.status_code)
    except (requests.RequestException, ValueError):
        logger.exception("tmdb_proxy request failed for path %s", tmdb_path)
        return Response({"error": "TMDB request failed."}, status=502)
