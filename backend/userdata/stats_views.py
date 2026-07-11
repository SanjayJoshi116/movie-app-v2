import logging
import time as _time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from threading import Thread

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WatchedEntry, RatingEntry, UserList, UserListItem, WatchlistEntry
from . import tmdb_client

logger = logging.getLogger(__name__)

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
    # Single fetch of the user's watched entries — every section below is
    # derived from this one list instead of re-querying `watched` per section.
    watched_list = list(WatchedEntry.objects.filter(user=request.user))
    ratings_qs = RatingEntry.objects.filter(user=request.user)

    total_watched = len(watched_list)
    movies_count = sum(1 for w in watched_list if w.media_type == "movie")
    tv_count = sum(1 for w in watched_list if w.media_type == "tv")

    all_ratings = list(ratings_qs.values_list("user_rating", flat=True))
    total_ratings = len(all_ratings)
    avg_user_rating = round(sum(all_ratings) / total_ratings, 1) if all_ratings else 0

    dist = {str(i): 0 for i in range(1, 11)}
    for r in all_ratings:
        bucket = str(min(10, max(1, round(r))))
        dist[bucket] += 1
    rating_distribution = [{"rating": k, "count": v} for k, v in dist.items()]

    monthly_counts: dict[tuple[int, int], int] = {}
    for entry in watched_list:
        month_key = (entry.watched_at.year, entry.watched_at.month)
        monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
    monthly_activity = [
        {"month": date(year, month, 1).strftime("%b %Y"), "count": monthly_counts[(year, month)]}
        for year, month in sorted(monthly_counts)
    ]

    genre_counts: dict[int, int] = {}
    for entry in watched_list:
        for gid in (entry.genre_ids or []):
            genre_counts[gid] = genre_counts.get(gid, 0) + 1

    genre_names = _get_cached_genre_names()
    top_genres = [
        {"genre": genre_names.get(gid, f"Genre {gid}"), "count": cnt}
        for gid, cnt in sorted(genre_counts.items(), key=lambda x: -x[1])[:10]
    ]

    avg_tmdb_rating = (
        round(sum(w.vote_average for w in watched_list) / total_watched, 1) if watched_list else None
    )

    total_runtime_minutes = sum(w.runtime_minutes or 0 for w in watched_list)
    platform_counter = Counter(w.platform for w in watched_list if w.platform)
    platform_breakdown = [{"platform": p, "count": c} for p, c in platform_counter.most_common(10)]

    missing = [w for w in watched_list if w.original_language is None or w.release_year is None]

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
                logger.exception("Failed to backfill language/year for WatchedEntry %s", entry.pk)

        def _run_backfill():
            with ThreadPoolExecutor(max_workers=20) as ex:
                list(ex.map(_fetch_and_update, missing))
        Thread(target=_run_backfill, daemon=True).start()

    lang_counter = Counter(
        e.original_language for e in watched_list
        if e.original_language and e.original_language not in ("??", "")
    )
    language_breakdown = [
        {"language": lang, "count": cnt}
        for lang, cnt in lang_counter.most_common(10)
    ]

    decade_counts: dict[str, int] = {}
    for entry in watched_list:
        if entry.release_year and entry.release_year > 0:
            decade = f"{(entry.release_year // 10) * 10}s"
            decade_counts[decade] = decade_counts.get(decade, 0) + 1
    decade_breakdown = [
        {"decade": decade, "count": cnt}
        for decade, cnt in sorted(decade_counts.items())
    ]

    cutoff = timezone.now() - timedelta(days=364)
    daily_counts: dict[date, int] = {}
    for entry in watched_list:
        if entry.watched_at >= cutoff:
            day = entry.watched_at.date()
            daily_counts[day] = daily_counts.get(day, 0) + 1
    daily_activity = [
        {"date": day.strftime("%Y-%m-%d"), "count": cnt}
        for day, cnt in sorted(daily_counts.items())
    ]

    rating_map = {
        (r.media_id, r.media_type): r.user_rating
        for r in ratings_qs.only("media_id", "media_type", "user_rating")
    }

    genre_rating_sum: dict[int, float] = {}
    genre_rating_n: dict[int, int] = {}
    for entry in watched_list:
        ur = rating_map.get((entry.media_id, entry.media_type))
        if ur is None:
            continue
        for gid in (entry.genre_ids or []):
            genre_rating_sum[gid] = genre_rating_sum.get(gid, 0) + ur
            genre_rating_n[gid] = genre_rating_n.get(gid, 0) + 1
    rating_by_genre = sorted([
        {"genre": genre_names.get(gid, f"Genre {gid}"), "avgRating": round(genre_rating_sum[gid] / n, 1)}
        for gid, n in genre_rating_n.items() if n >= 3
    ], key=lambda x: -x["avgRating"])[:10]

    reviews_written = ratings_qs.exclude(review="").count()

    lists_qs = UserList.objects.filter(user=request.user)
    lists_count = lists_qs.count()
    lists_items_count = UserListItem.objects.filter(user_list__in=lists_qs).count()

    watched_keys = {(w.media_id, w.media_type) for w in watched_list}
    watchlist_qs = WatchlistEntry.objects.filter(user=request.user)
    watchlist_total = watchlist_qs.count()
    watchlist_unwatched = sum(
        1 for e in watchlist_qs if (e.media_id, e.media_type) not in watched_keys
    )

    top_rated: list[dict] = []
    for entry in watched_list:
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

    recent_sorted = sorted(watched_list, key=lambda e: e.watched_at, reverse=True)
    recent_items = [
        {
            "title": e.title,
            "posterPath": e.poster_path,
            "watchedAt": e.watched_at.strftime("%Y-%m-%d"),
            "mediaType": e.media_type,
        }
        for e in recent_sorted[:8]
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
        "totalRuntimeMinutes": total_runtime_minutes,
        "platformBreakdown": platform_breakdown,
        "ratingByGenre": rating_by_genre,
        "reviewsWritten": reviews_written,
        "listsCount": lists_count,
        "listsItemsCount": lists_items_count,
        "watchlistTotal": watchlist_total,
        "watchlistUnwatched": watchlist_unwatched,
    })
