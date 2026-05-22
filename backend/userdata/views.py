from concurrent.futures import ThreadPoolExecutor
from django.contrib.auth.models import User
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import WatchlistEntry, WatchedEntry, RatingEntry, UserList, UserListItem, TMDBProfile, EpisodeProgress, FollowedPerson
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


# ── Password Reset ─────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from django.core.mail import send_mail
    from django.conf import settings

    email = request.data.get("email", "").strip()
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email)
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        send_mail(
            subject="Reset your CINE DB password",
            message=(
                f"Hi {user.username},\n\n"
                f"Click the link below to reset your password:\n{reset_url}\n\n"
                f"This link expires in 1 hour.\n\n"
                f"If you didn't request this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except User.DoesNotExist:
        pass  # Don't reveal whether the email is registered

    return Response({"detail": "If that email is registered, a reset link has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_decode
    from django.utils.encoding import force_str

    uid = request.data.get("uid", "")
    token = request.data.get("token", "")
    new_password = request.data.get("new_password", "")

    if not uid or not token or not new_password:
        return Response({"detail": "uid, token, and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 6:
        return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({"detail": "Reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({"detail": "Password reset successfully."})



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


# ── Stats ─────────────────────────────────────────────────────────────────────

_genre_name_cache: dict[int, str] = {}


def _get_cached_genre_names() -> dict[int, str]:
    """Fetch genre names from TMDB once per process and cache in memory."""
    global _genre_name_cache
    if not _genre_name_cache:
        try:
            _genre_name_cache = {**tmdb_client.get_genre_names("movie"), **tmdb_client.get_genre_names("tv")}
        except Exception:
            pass
    return _genre_name_cache


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stats(request):
    watched = WatchedEntry.objects.filter(user=request.user)
    ratings_qs = RatingEntry.objects.filter(user=request.user)

    total_watched = watched.count()
    movies_count = watched.filter(media_type="movie").count()
    tv_count = watched.filter(media_type="tv").count()

    all_ratings = list(ratings_qs.values_list("user_rating", flat=True))
    total_ratings = len(all_ratings)
    avg_user_rating = round(sum(all_ratings) / total_ratings, 1) if all_ratings else 0

    # Ratings distribution in buckets 1–10
    dist = {str(i): 0 for i in range(1, 11)}
    for r in all_ratings:
        bucket = str(min(10, max(1, round(r))))
        dist[bucket] += 1
    rating_distribution = [{"rating": k, "count": v} for k, v in dist.items()]

    # Monthly activity — all time, ordered chronologically
    monthly_qs = (
        watched.annotate(month=TruncMonth("watched_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    monthly_activity = [
        {"month": m["month"].strftime("%b %Y"), "count": m["count"]}
        for m in monthly_qs
    ]

    # Genre breakdown from cached genre_ids
    genre_counts: dict[int, int] = {}
    for entry in watched.only("genre_ids"):
        for gid in (entry.genre_ids or []):
            genre_counts[gid] = genre_counts.get(gid, 0) + 1

    genre_names = _get_cached_genre_names()

    top_genres = [
        {"genre": genre_names.get(gid, f"Genre {gid}"), "count": cnt}
        for gid, cnt in sorted(genre_counts.items(), key=lambda x: -x[1])[:10]
    ]

    return Response({
        "totalWatched": total_watched,
        "moviesCount": movies_count,
        "tvCount": tv_count,
        "totalRatings": total_ratings,
        "avgUserRating": avg_user_rating,
        "ratingDistribution": rating_distribution,
        "monthlyActivity": monthly_activity,
        "topGenres": top_genres,
    })


# ── Episode Progress ──────────────────────────────────────────────────────────

@api_view(["GET", "POST", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def episode_progress(request, show_id: int):
    if request.method == "GET":
        try:
            prog = EpisodeProgress.objects.get(user=request.user, show_id=show_id)
            return Response({"showId": prog.show_id, "season": prog.season_number, "episode": prog.episode_number})
        except EpisodeProgress.DoesNotExist:
            return Response(None)

    if request.method == "DELETE":
        EpisodeProgress.objects.filter(user=request.user, show_id=show_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    try:
        season = int(request.data.get("season", 1))
        episode = int(request.data.get("episode", 1))
    except (TypeError, ValueError):
        return Response({"detail": "season and episode must be integers."}, status=status.HTTP_400_BAD_REQUEST)
    if season < 1 or episode < 1:
        return Response({"detail": "season and episode must be >= 1."}, status=status.HTTP_400_BAD_REQUEST)

    prog, _ = EpisodeProgress.objects.update_or_create(
        user=request.user,
        show_id=show_id,
        defaults={"season_number": season, "episode_number": episode},
    )
    return Response({"showId": prog.show_id, "season": prog.season_number, "episode": prog.episode_number})


# ── Followed People ───────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def followed_people_list(request):
    if request.method == "GET":
        people = FollowedPerson.objects.filter(user=request.user).order_by("-followed_at")
        return Response([
            {"id": p.id, "personId": p.person_id, "name": p.name, "profilePath": p.profile_path}
            for p in people
        ])

    person_id = request.data.get("personId")
    name = request.data.get("name", "")
    profile_path = request.data.get("profilePath")
    if not person_id:
        return Response({"detail": "personId is required."}, status=status.HTTP_400_BAD_REQUEST)

    fp, created = FollowedPerson.objects.get_or_create(
        user=request.user,
        person_id=person_id,
        defaults={"name": name, "profile_path": profile_path},
    )
    return Response(
        {"id": fp.id, "personId": fp.person_id, "name": fp.name, "profilePath": fp.profile_path},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def followed_people_detail(request, person_id: int):
    try:
        fp = FollowedPerson.objects.get(user=request.user, person_id=person_id)
        fp.delete()
    except FollowedPerson.DoesNotExist:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def followed_people_recommendations(request):
    """Return top-rated credits for each followed person as recommendation sections."""
    followed = list(FollowedPerson.objects.filter(user=request.user).order_by("-followed_at")[:10])
    if not followed:
        return Response([])

    watched_set = {
        (e.media_id, e.media_type)
        for e in WatchedEntry.objects.filter(user=request.user).only("media_id", "media_type")
    }

    def fetch_credits(fp):
        try:
            data = tmdb_client._get(f"/person/{fp.person_id}/combined_credits")
            items = []
            seen_ids = set()
            for c in data.get("cast", []):
                if c.get("media_type") not in ("movie", "tv"):
                    continue
                mid = c.get("id")
                if (mid, c["media_type"]) in watched_set or mid in seen_ids:
                    continue
                if (c.get("vote_average") or 0) < 6:
                    continue
                seen_ids.add(mid)
                items.append({
                    "id": mid,
                    "type": c["media_type"],
                    "title": c.get("title") or c.get("name", ""),
                    "posterPath": c.get("poster_path"),
                    "voteAverage": c.get("vote_average", 0),
                })
            items.sort(key=lambda x: -x["voteAverage"])
            return fp.name, items[:12]
        except Exception:
            return fp.name, []

    sections = []
    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(fetch_credits, followed))

    for name, items in results:
        if items:
            sections.append({"key": f"follow-{name}", "label": f"New from {name}", "items": items})

    return Response(sections)
