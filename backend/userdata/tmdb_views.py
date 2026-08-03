import requests
from django.db import Error as DBError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TMDBProfile
from . import tmdb_client


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tmdb_request_token(request):
    redirect_to = request.query_params.get("redirect_to", "")
    try:
        data = tmdb_client.get_request_token()
        token = data["request_token"]
        redirect_url = f"https://www.themoviedb.org/authenticate/{token}?redirect_to={redirect_to}"
        return Response({"redirect_url": redirect_url, "request_token": token})
    except (requests.RequestException, ValueError, KeyError) as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tmdb_create_session(request):
    request_token = request.data.get("request_token", "")
    if not request_token:
        return Response({"error": "request_token is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        data = tmdb_client.create_session(request_token)
        session_id = data["session_id"]
        profile, _ = TMDBProfile.objects.get_or_create(user=request.user)
        profile.session_id = session_id
        profile.save()
        return Response({"connected": True})
    except (requests.RequestException, ValueError, KeyError, DBError) as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


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
        profile.session_id = ""
        profile.save()
    except TMDBProfile.DoesNotExist:
        pass
    return Response({"connected": False})
