from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import WatchlistEntry, WatchedEntry, RatingEntry, UserList, UserListItem, TMDBProfile
from . import tmdb_client
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserProfileUpdateSerializer,
    WatchlistEntrySerializer,
    WatchedEntrySerializer,
    RatingEntrySerializer,
    UserListSerializer,
    UserListItemSerializer,
)


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


# ── Auth ──────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    tokens = _tokens_for_user(user)
    return Response(
        {"user": UserSerializer(user).data, **tokens},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    from django.contrib.auth import authenticate

    username = request.data.get("username", "")
    password = request.data.get("password", "")
    user = authenticate(username=username, password=password)
    if user is None:
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
    tokens = _tokens_for_user(user)
    return Response({"user": UserSerializer(user).data, **tokens})


# ── Profile ───────────────────────────────────────────────────────────────────

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    serializer = UserProfileUpdateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    user = request.user
    for field in ("first_name", "last_name", "username", "email"):
        if field in data:
            setattr(user, field, data[field])
    if data.get("new_password"):
        user.set_password(data["new_password"])
    user.save()
    return Response(UserSerializer(user).data)


# ── Watchlist ─────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def watchlist_list(request):
    if request.method == "GET":
        entries = WatchlistEntry.objects.filter(user=request.user).order_by("-added_at")
        return Response(WatchlistEntrySerializer(entries, many=True).data)

    serializer = WatchlistEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, created = WatchlistEntry.objects.get_or_create(
        user=request.user,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
        },
    )
    return Response(
        WatchlistEntrySerializer(entry).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def watchlist_detail(request, pk):
    entry = get_object_or_404(WatchlistEntry, pk=pk, user=request.user)
    if request.method == "DELETE":
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = WatchlistEntrySerializer(entry, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ── Watched ───────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def watched_list(request):
    if request.method == "GET":
        entries = WatchedEntry.objects.filter(user=request.user).order_by("-watched_at")
        return Response(WatchedEntrySerializer(entries, many=True).data)

    serializer = WatchedEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, created = WatchedEntry.objects.get_or_create(
        user=request.user,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
        },
    )
    return Response(
        WatchedEntrySerializer(entry).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def watched_detail(request, pk):
    entry = get_object_or_404(WatchedEntry, pk=pk, user=request.user)
    entry.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def watched_clear(request):
    deleted, _ = WatchedEntry.objects.filter(user=request.user).delete()
    return Response({"deleted": deleted}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_watched(request):
    entries = request.data.get("entries", [])
    if not isinstance(entries, list):
        return Response({"detail": "entries must be a list."}, status=status.HTTP_400_BAD_REQUEST)

    media_type = request.data.get("mediaType", "movie")
    if media_type not in ("movie", "tv"):
        return Response({"detail": "mediaType must be 'movie' or 'tv'."}, status=status.HTTP_400_BAD_REQUEST)

    added = 0
    skipped = 0
    for item in entries:
        media_id = item.get("mediaId")
        title = item.get("title", "")
        if not media_id:
            continue
        _, created = WatchedEntry.objects.get_or_create(
            user=request.user,
            media_id=media_id,
            media_type=media_type,
            defaults={
                "title": title,
                "poster_path": item.get("posterPath"),
                "vote_average": item.get("voteAverage", 0),
            },
        )
        if created:
            added += 1
        else:
            skipped += 1

    return Response({"added": added, "skipped": skipped}, status=status.HTTP_200_OK)


# ── Ratings ───────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def ratings_list(request):
    if request.method == "GET":
        entries = RatingEntry.objects.filter(user=request.user).order_by("-rated_at")
        return Response(RatingEntrySerializer(entries, many=True).data)

    serializer = RatingEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, _ = RatingEntry.objects.update_or_create(
        user=request.user,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "user_rating": serializer.validated_data["user_rating"],
            "review": serializer.validated_data.get("review", ""),
        },
    )
    # Mirror rating to TMDB if user has a connected session
    try:
        tmdb_profile = request.user.tmdb_profile
        if tmdb_profile.session_id:
            tmdb_client.post_rating(
                entry.media_type,
                entry.media_id,
                tmdb_profile.session_id,
                entry.user_rating,
            )
    except (TMDBProfile.DoesNotExist, AttributeError, Exception):
        pass  # TMDB sync is best-effort; local save already succeeded

    return Response(RatingEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def ratings_detail(request, pk):
    entry = get_object_or_404(RatingEntry, pk=pk, user=request.user)
    if request.method == "DELETE":
        # Mirror deletion to TMDB if user has a connected session
        try:
            tmdb_profile = request.user.tmdb_profile
            if tmdb_profile.session_id:
                tmdb_client.delete_rating(entry.media_type, entry.media_id, tmdb_profile.session_id)
        except (TMDBProfile.DoesNotExist, AttributeError, Exception):
            pass
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = RatingEntrySerializer(entry, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ── Lists ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def lists_list(request):
    if request.method == "GET":
        user_lists = UserList.objects.filter(user=request.user).prefetch_related("items").order_by("-created_at")
        return Response(UserListSerializer(user_lists, many=True).data)

    serializer = UserListSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user_list = UserList.objects.create(
        user=request.user,
        name=serializer.validated_data["name"],
        description=serializer.validated_data.get("description", ""),
    )
    return Response(UserListSerializer(user_list).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def lists_detail(request, pk):
    user_list = get_object_or_404(UserList, pk=pk, user=request.user)
    user_list.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def list_items_create(request, list_pk):
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)
    serializer = UserListItemSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    item, created = UserListItem.objects.get_or_create(
        user_list=user_list,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
        },
    )
    return Response(
        UserListItemSerializer(item).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def list_items_detail(request, list_pk, item_pk):
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)
    item = get_object_or_404(UserListItem, pk=item_pk, user_list=user_list)
    item.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── TMDB OAuth ────────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tmdb_request_token(request):
    """Return a TMDB request token and the approval redirect URL."""
    redirect_to = request.query_params.get("redirect_to", "")
    try:
        data = tmdb_client.get_request_token()
        token = data["request_token"]
        redirect_url = f"https://www.themoviedb.org/authenticate/{token}?redirect_to={redirect_to}"
        return Response({"redirect_url": redirect_url, "request_token": token})
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tmdb_create_session(request):
    """Exchange an approved request token for a session_id and store it."""
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
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tmdb_auth_status(request):
    """Return whether the user has a connected TMDB session."""
    try:
        profile = request.user.tmdb_profile
        return Response({"connected": bool(profile.session_id)})
    except TMDBProfile.DoesNotExist:
        return Response({"connected": False})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def tmdb_disconnect(request):
    """Clear the user's TMDB session."""
    try:
        profile = request.user.tmdb_profile
        profile.session_id = ""
        profile.save()
    except TMDBProfile.DoesNotExist:
        pass
    return Response({"connected": False})
