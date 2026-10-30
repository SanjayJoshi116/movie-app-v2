import hmac
import logging
from urllib.parse import urlencode

import requests
from django.core.cache import cache
from django.db import Error as DBError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TMDBProfile
from .serializers import TMDBSessionInputSerializer
from . import tmdb_client

logger = logging.getLogger(__name__)

TMDB_UNREACHABLE = "Couldn't reach TMDB. Try again."
TMDB_CONNECT_RESTART = (
    "This TMDB link wasn't started from your account, or it expired. Connect again from your profile."
)
# TMDB request tokens are valid for 60 minutes.
REQUEST_TOKEN_TTL_SECONDS = 60 * 60


def _request_token_key(user_id):
    return f"tmdb_req_token:{user_id}"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tmdb_request_token(request):
    redirect_to = request.query_params.get("redirect_to", "")
    try:
        # Bounded: this request waits on it (tmdb_client.TMDB_CALL_DEADLINE).
        data = tmdb_client.call_with_deadline(tmdb_client.get_request_token, tmdb_client.TMDB_CALL_DEADLINE)
        token = data["request_token"]
        # Only the token issued to this user can complete a connection, so a
        # callback link carrying someone else's approved token is refused.
        cache.set(_request_token_key(request.user.id), token, REQUEST_TOKEN_TTL_SECONDS)
        redirect_url = f"https://www.themoviedb.org/authenticate/{token}?{urlencode({'redirect_to': redirect_to})}"
        return Response({"redirect_url": redirect_url, "request_token": token})
    except (requests.RequestException, ValueError, KeyError) as e:
        # str(e) embeds the request URL incl. ?api_key= — log it (redacted by
        # RedactingFormatter), never echo it to the client.
        logger.warning("TMDB request-token failed: %s", e)
        return Response({"error": TMDB_UNREACHABLE}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tmdb_create_session(request):
    body = TMDBSessionInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    request_token = body.validated_data["request_token"]
    if not request_token:
        return Response({"error": "request_token is required."}, status=status.HTTP_400_BAD_REQUEST)
    # Single use: the issued token is consumed even if TMDB then fails. Of two
    # requests that both read it, only the one whose delete removed it goes on.
    key = _request_token_key(request.user.id)
    issued = cache.get(key)
    consumed = cache.delete(key)
    if not consumed or not isinstance(issued, str) or not hmac.compare_digest(issued, request_token):
        return Response({"error": TMDB_CONNECT_RESTART}, status=status.HTTP_400_BAD_REQUEST)
    try:
        data = tmdb_client.call_with_deadline(
            tmdb_client.create_session, tmdb_client.TMDB_CALL_DEADLINE, request_token
        )
        session_id = data["session_id"]
        if not isinstance(session_id, str) or not session_id:
            # Nothing usable to store (or to revoke): a malformed answer, not a 500.
            raise ValueError("TMDB returned no usable session id")
    except (requests.RequestException, ValueError, KeyError, TypeError) as e:
        # Type only: this call carries the request token.
        logger.warning("TMDB create-session failed for user %s (%s)", request.user.id, type(e).__name__)
        return Response({"error": TMDB_UNREACHABLE}, status=status.HTTP_502_BAD_GATEWAY)
    try:
        profile, _ = TMDBProfile.objects.get_or_create(user=request.user)
        old_session_id = profile.session_id
        # Store the new session first, then revoke the old one after commit in
        # the background: a request that dies partway (or a failed save) can
        # then never leave a revoked session stored.
        profile.session_id = session_id
        profile.save()
        if old_session_id and old_session_id != session_id:
            tmdb_client.revoke_in_background(request.user.id, old_session_id)
        return Response({"connected": True})
    except DBError as e:
        # TMDB issued a session the app couldn't store: revoke it, so no live
        # session exists that nothing knows about. The old one stays as it was.
        logger.warning("Storing the TMDB session failed for user %s (%s)", request.user.id, type(e).__name__)
        tmdb_client.revoke_in_background(request.user.id, session_id)
        return Response({"error": TMDB_UNREACHABLE}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tmdb_auth_status(request):
    try:
        profile = request.user.tmdb_profile
        return Response({"connected": bool(profile.session_id)})
    except TMDBProfile.DoesNotExist:
        return Response({"connected": False})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def tmdb_disconnect(request):
    try:
        profile = request.user.tmdb_profile
    except TMDBProfile.DoesNotExist:
        return Response({"connected": False})
    if profile.session_id:
        # Forget it first, then revoke in the background: the disconnect never
        # waits on TMDB, and a TMDB failure is only logged.
        session_id = profile.session_id
        profile.session_id = ""
        profile.save()
        tmdb_client.revoke_in_background(request.user.id, session_id)
    return Response({"connected": False})
