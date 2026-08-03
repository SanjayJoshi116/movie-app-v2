import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tmdb_client import TMDB_BASE

# Shared session: pools/reuses connections instead of a fresh TLS handshake
# per call, and retries transient connection resets — movie detail pages
# fire ~6 concurrent proxy requests, which was seeing sporadic connection
# errors under that burst with a bare per-call requests.get().
_session = requests.Session()
_session.mount(
    "https://",
    HTTPAdapter(max_retries=Retry(total=2, backoff_factor=0.3, connect=2, read=2)),
)


@api_view(["GET"])
@permission_classes([AllowAny])
def tmdb_proxy(request, tmdb_path):
    params = {**request.GET.dict(), "api_key": settings.TMDB_API_KEY}
    try:
        r = _session.get(f"{TMDB_BASE}/{tmdb_path}", params=params, timeout=20)
        return Response(r.json(), status=r.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=502)
