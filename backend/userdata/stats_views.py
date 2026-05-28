import time as _time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Thread

from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncMonth, TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WatchedEntry, RatingEntry
from . import tmdb_client


_genre_name_cache: dict[int, str] = {}
_genre_cache_ts: float = 0.0
_GENRE_CACHE_TTL = 86400  # 24 hours


def _get_cached_genre_names() -> dict[int, str]:
    global _genre_name_cache, _genre_cache_ts
    if not _genre_name_cache or (_time.time() - _genre_cache_ts) > _GENRE_CACHE_TTL:
        try:
            _genre_name_cache = {**tmdb_client.get_genre_names("movie"), **tmdb_client.get_genre_names("tv")}
            _genre_cache_ts = _time.time()
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

    dist = {str(i): 0 for i in range(1, 11)}
    for r in all_ratings:
        bucket = str(min(10, max(1, round(r))))
        dist[bucket] += 1
    rating_distribution = [{"rating": k, "count": v} for k, v in dist.items()]

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

    genre_counts: dict[int, int] = {}
    for entry in watched.only("genre_ids"):
        for gid in (entry.genre_ids or []):
            genre_counts[gid] = genre_counts.get(gid, 0) + 1

    genre_names = _get_cached_genre_names()
    top_genres = [
        {"genre": genre_names.get(gid, f"Genre {gid}"), "count": cnt}
        for gid, cnt in sorted(genre_counts.items(), key=lambda x: -x[1])[:10]
    ]

    avg_tmdb = watched.aggregate(Avg("vote_average"))["vote_average__avg"]
    avg_tmdb_rating = round(avg_tmdb, 1) if avg_tmdb else None

    missing = list(
        watched.filter(Q(original_language__isnull=True) | Q(release_year__isnull=True))
        .only("id", "media_id", "media_type")
    )

    if missing:
        def _fetch_and_update(entry):
            try:
                data = tmdb_client._get(f"/{entry.media_type}/{entry.media_id}")
                lang = data.get("original_language") or "??"
                date_field = "release_date" if entry.media_type == "movie" else "first_air_date"
                date_str = data.get(date_field) or ""
                year = int(date_str[:4]) if len(date_str) >= 4 else -1
                WatchedEntry.objects.filter(pk=entry.pk).update(
                    original_language=lang,
                    release_year=year,
                )
            except Exception:
                pass

        def _run_backfill():
            with ThreadPoolExecutor(max_workers=20) as ex:
                list(ex.map(_fetch_and_update, missing))
        Thread(target=_run_backfill, daemon=True).start()

    lang_counter = Counter(
        e.original_language for e in watched.only("original_language")
        if e.original_language and e.original_language not in ("??", "")
    )
    language_breakdown = [
        {"language": lang, "count": cnt}
        for lang, cnt in lang_counter.most_common(10)
    ]

    decade_counts: dict[str, int] = {}
    for entry in watched.only("release_year"):
        if entry.release_year and entry.release_year > 0:
            decade = f"{(entry.release_year // 10) * 10}s"
            decade_counts[decade] = decade_counts.get(decade, 0) + 1
    decade_breakdown = [
        {"decade": decade, "count": cnt}
        for decade, cnt in sorted(decade_counts.items())
    ]

    cutoff = timezone.now() - timedelta(days=364)
    daily_qs = (
        watched.filter(watched_at__gte=cutoff)
        .annotate(date=TruncDate("watched_at"))
        .values("date")
        .annotate(count=Count("id"))
        .order_by("date")
    )
    daily_activity = [
        {"date": d["date"].strftime("%Y-%m-%d"), "count": d["count"]}
        for d in daily_qs
    ]

    rating_map = {
        (r.media_id, r.media_type): r.user_rating
        for r in ratings_qs.only("media_id", "media_type", "user_rating")
    }
    top_rated: list[dict] = []
    for entry in watched.only("media_id", "media_type", "title", "poster_path"):
        user_rating = rating_map.get((entry.media_id, entry.media_type))
        if user_rating is not None:
            top_rated.append({
                "title": entry.title,
                "posterPath": entry.poster_path,
                "userRating": user_rating,
                "mediaType": entry.media_type,
            })
    top_rated.sort(key=lambda x: -x["userRating"])
    top_rated_items = top_rated[:8]

    recent_items = [
        {
            "title": e.title,
            "posterPath": e.poster_path,
            "watchedAt": e.watched_at.strftime("%Y-%m-%d"),
            "mediaType": e.media_type,
        }
        for e in watched.order_by("-watched_at")[:8]
    ]

    return Response({
        "totalWatched": total_watched,
        "moviesCount": movies_count,
        "tvCount": tv_count,
        "totalRatings": total_ratings,
        "avgUserRating": avg_user_rating,
        "avgTmdbRating": avg_tmdb_rating,
        "ratingDistribution": rating_distribution,
        "monthlyActivity": monthly_activity,
        "topGenres": top_genres,
        "languageBreakdown": language_breakdown,
        "decadeBreakdown": decade_breakdown,
        "dailyActivity": daily_activity,
        "topRatedItems": top_rated_items,
        "recentItems": recent_items,
    })
