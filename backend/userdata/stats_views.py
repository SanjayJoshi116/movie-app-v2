import logging
import time as _time
from collections import Counter
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .metadata_backfill import entry_needs_metadata, request_backfill
from .models import WatchedEntry, RatingEntry, UserList, UserListItem, WatchlistEntry
from . import genre_families, tmdb_client
from .timezones import entry_day, entry_local, local_today

logger = logging.getLogger(__name__)

_genre_name_cache: dict[int, str] = {}
_genre_cache_ts: float = 0.0
_genre_cache_ttl: float = 0.0
_GENRE_CACHE_TTL = 86400  # 24 hours
# After a failed lookup the built-in names are used, and TMDB is tried again
# after this long instead of after a full day.
_GENRE_FALLBACK_TTL = 300
# (connect, read) per attempt of a genre call, and a wall-clock deadline per
# call: per-attempt timeouts alone don't bound it, because the connect is tried
# once per address DNS returns. The two calls run back to back on a cold cache,
# so 2 * GENRE_LOOKUP_DEADLINE must stay well under gunicorn's --timeout
# (docker-entrypoint.sh); test_stats_genres pins the margin.
GENRE_LOOKUP_TIMEOUT = (3.05, 5)
GENRE_LOOKUP_DEADLINE = 8


def round_half_up(value: float, places: int = 1) -> float:
    """Round halves up (7.25 -> 7.3), not to even as round() does (7.25 -> 7.2).
    Going through str keeps a float like 7.249999 from drifting."""
    quantum = Decimal(1).scaleb(-places)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


def rating_bucket(rating: float) -> int:
    """Whole-star bucket for a half-step rating, halves up: each of 1..10 holds
    two half-steps (0.5 and 1.0 -> 1, 6.5 and 7.0 -> 7)."""
    return min(10, max(1, int(Decimal(str(rating)).quantize(Decimal(1), rounding=ROUND_HALF_UP))))


def _month_range(first: tuple[int, int], last: tuple[int, int]) -> list[tuple[int, int]]:
    year, month = first
    months = []
    while (year, month) <= last:
        months.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months


def _get_cached_genre_names() -> dict[int, str]:
    global _genre_name_cache, _genre_cache_ts, _genre_cache_ttl
    if not _genre_name_cache or (_time.time() - _genre_cache_ts) > _genre_cache_ttl:
        try:
            def lookup(media_type):
                return tmdb_client.call_with_deadline(
                    tmdb_client.get_genre_names, GENRE_LOOKUP_DEADLINE,
                    media_type, GENRE_LOOKUP_TIMEOUT, fallback=False,
                )
            _genre_name_cache = {**lookup("movie"), **lookup("tv")}
            _genre_cache_ttl = _GENRE_CACHE_TTL
        except (requests.RequestException, ValueError, KeyError, TypeError) as e:
            logger.warning("Genre names lookup failed, using built-in names: %s", type(e).__name__)
            _genre_name_cache = dict(tmdb_client.STATIC_GENRE_NAMES)
            _genre_cache_ttl = _GENRE_FALLBACK_TTL
        _genre_cache_ts = _time.time()
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
    avg_user_rating = round_half_up(sum(all_ratings) / total_ratings) if all_ratings else 0

    dist = {str(i): 0 for i in range(1, 11)}
    for r in all_ratings:
        bucket = str(rating_bucket(r))
        dist[bucket] += 1
    rating_distribution = [{"rating": k, "count": v} for k, v in dist.items()]

    monthly_counts: dict[tuple[int, int], int] = {}
    for entry in watched_list:
        # Days and months come from the zone each watch was logged in.
        local = entry_local(entry, request)
        month_key = (local.year, local.month)
        monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
    # Every month from the first watch through this month (on the requesting
    # device), zeros included: the chart's category axis would otherwise put
    # January next to June. A stored watch past "today" (clock skew) extends it.
    monthly_activity = []
    if monthly_counts:
        today = local_today(request)
        last = max(max(monthly_counts), (today.year, today.month))
        monthly_activity = [
            {"month": date(year, month, 1).strftime("%b %Y"), "count": monthly_counts.get((year, month), 0)}
            for year, month in _month_range(min(monthly_counts), last)
        ]

    # Families, not raw ids: a movie's Action and a show's Action & Adventure
    # are one genre here, the same as in recommendations (genre_families).
    genre_counts: dict[str, int] = {}
    for entry in watched_list:
        for family in genre_families.families(entry.genre_ids, entry.media_type):
            genre_counts[family] = genre_counts.get(family, 0) + 1

    genre_names = _get_cached_genre_names()
    top_genres = [
        {"genre": genre_families.family_name(family, genre_names), "count": cnt}
        for family, cnt in sorted(genre_counts.items(), key=lambda x: -x[1])[:10]
    ]

    # 0 is what's stored for "no score" (unreleased titles, CSV rows without
    # one), so it would only drag the average down. Values over 10 predate the
    # input bounds (crafted imports); one huge one made round_half_up raise.
    scored = [w.vote_average for w in watched_list if w.vote_average and 0 < w.vote_average <= 10]
    avg_tmdb_rating = round_half_up(sum(scored) / len(scored)) if scored else None

    total_runtime_minutes = sum(w.runtime_minutes or 0 for w in watched_list)
    platform_counter = Counter(w.platform for w in watched_list if w.platform)
    platform_breakdown = [{"platform": p, "count": c} for p, c in platform_counter.most_common(10)]

    # Genres, language and year are filled in the background (single-flight
    # per user); this response uses what's stored now, later ones pick it up.
    if any(entry_needs_metadata(w) for w in watched_list):
        request_backfill(request.user.id)

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

    # The window ends on the requesting device's today (the heatmap grid's last day).
    cutoff = local_today(request) - timedelta(days=364)
    daily_counts: dict[date, int] = {}
    for entry in watched_list:
        day = entry_day(entry, request)
        if day >= cutoff:
            daily_counts[day] = daily_counts.get(day, 0) + 1
    daily_activity = [
        {"date": day.strftime("%Y-%m-%d"), "count": cnt}
        for day, cnt in sorted(daily_counts.items())
    ]

    rating_map = {
        (r.media_id, r.media_type): r.user_rating
        for r in ratings_qs.only("media_id", "media_type", "user_rating")
    }

    genre_rating_sum: dict[str, float] = {}
    genre_rating_n: dict[str, int] = {}
    for entry in watched_list:
        ur = rating_map.get((entry.media_id, entry.media_type))
        if ur is None:
            continue
        for family in genre_families.families(entry.genre_ids, entry.media_type):
            genre_rating_sum[family] = genre_rating_sum.get(family, 0) + ur
            genre_rating_n[family] = genre_rating_n.get(family, 0) + 1
    rating_by_genre = sorted([
        {"genre": genre_families.family_name(family, genre_names),
         "avgRating": round_half_up(genre_rating_sum[family] / n)}
        for family, n in genre_rating_n.items() if n >= 3
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
            "watchedAt": entry_day(e, request).strftime("%Y-%m-%d"),
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
