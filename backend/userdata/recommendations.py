import contextlib
import logging
import operator
import random
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from functools import partial, reduce

import numpy as np
import requests
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db import Error as DBError
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity

from . import tmdb_client
from .metadata_backfill import backfill_entries
from .models import RatingEntry, TMDBMediaCache, UserRecommendationCache, WatchedEntry

logger = logging.getLogger(__name__)

CACHE_TTL_DAYS = 7
RECOMMENDATIONS_TTL_HOURS = 12

_computing_lock = threading.Lock()
_computing_users = set()  # user ids currently being (re)computed, in-process only
_rerun_users = set()  # in-flight user ids that got another trigger; get one follow-up run


def _spawn_refresh(user_id):
    threading.Thread(target=_refresh_cache_by_id, args=(user_id,), daemon=True).start()


def request_refresh(user_id, *, rerun_if_running):
    """Schedule a background refresh for user_id, coalesced per user.

    At most one refresh runs per user at a time. If one is already running and
    rerun_if_running is set (the data changed, so its result will be stale),
    exactly one follow-up run is queued no matter how many triggers arrive.
    """
    with _computing_lock:
        if user_id in _computing_users:
            if rerun_if_running:
                _rerun_users.add(user_id)
            return
        _computing_users.add(user_id)
    _spawn_refresh(user_id)


def _start_refresh_if_needed(user):
    """Start a background refresh for user unless one is already running. Returns True if now computing."""
    request_refresh(user.id, rerun_if_running=False)
    return True


def _ensure_cached(entry, prefetched=None):
    """Return a TMDBMediaCache row for entry, fetching from TMDB if stale/missing.

    `prefetched` is an optional {(media_id, media_type): row} dict built with a
    single bulk query, to avoid one DB lookup per entry when called from a loop.
    """
    cutoff = timezone.now() - timedelta(days=CACHE_TTL_DAYS)
    key = (entry.media_id, entry.media_type)
    if prefetched is not None:
        cached = prefetched.get(key)
    else:
        cached = TMDBMediaCache.objects.filter(
            media_id=entry.media_id, media_type=entry.media_type
        ).first()
    if cached and cached.cached_at >= cutoff:
        return cached
    try:
        details = tmdb_client.get_details_with_cast(entry.media_id, entry.media_type)
    except (requests.RequestException, KeyError, TypeError, ValueError) as e:
        # Never cache a failure: writing empty genres/cast here used to replace
        # good data and hide the title for a whole CACHE_TTL_DAYS. Keep any
        # existing (even stale) row; with none, store nothing so the next run
        # retries.
        logger.warning("TMDB cache fetch failed for %s %s: %s", entry.media_type, entry.media_id, e)
        return cached
    try:
        cached, _ = TMDBMediaCache.objects.update_or_create(
            media_id=entry.media_id,
            media_type=entry.media_type,
            defaults={"genre_ids": details["genre_ids"], "top_cast": details["top_cast"]},
        )
    except IntegrityError:
        # Another thread won the race — just read what it wrote
        cached = TMDBMediaCache.objects.filter(
            media_id=entry.media_id, media_type=entry.media_type
        ).first()
    return cached


def _interleave(a, b):
    result = []
    for i in range(max(len(a), len(b))):
        if i < len(a):
            result.append(a[i])
        if i < len(b):
            result.append(b[i])
    return result


def _tmdb_item(r, media_type):
    return {
        "id": r.get("id"),
        "type": media_type,
        "title": r.get("title") or r.get("name", ""),
        "posterPath": r.get("poster_path"),
        "voteAverage": r.get("vote_average", 0),
    }


def _compute_for_you(user) -> list:
    """Compute for-you recommendation sections for a user. Returns list of sections."""
    watched = list(WatchedEntry.objects.filter(user=user))
    if not watched:
        return []

    rating_map = {
        f"{r.media_type}-{r.media_id}": r.user_rating
        for r in RatingEntry.objects.filter(user=user)
    }

    # ── Cache: bulk-prefetch existing rows, then parallel fetch/refresh ──────
    pairs_q = reduce(operator.or_, (Q(media_id=w.media_id, media_type=w.media_type) for w in watched))
    prefetched = {
        (row.media_id, row.media_type): row for row in TMDBMediaCache.objects.filter(pairs_q)
    }
    with ThreadPoolExecutor(max_workers=10) as ex:
        cache_rows = list(ex.map(partial(_ensure_cached, prefetched=prefetched), watched))

    cache_by_key = {
        f"{row.media_type}-{row.media_id}": row for row in cache_rows if row
    }

    # ── Build frequency maps ─────────────────────────────────────────────────
    genre_count = {}
    loved_genre_count = {}
    cast_count = {}

    cast_sample_keys = {
        f"{w.media_type}-{w.media_id}"
        for w in random.sample(watched, min(20, len(watched)))
    }

    sorted_watched = sorted(
        watched,
        key=lambda w: (-(rating_map.get(f"{w.media_type}-{w.media_id}", 0)), -w.watched_at.timestamp()),
    )

    for w in watched:
        key = f"{w.media_type}-{w.media_id}"
        row = cache_by_key.get(key)
        if not row:
            continue
        user_rating = rating_map.get(key, 0)
        for gid in (row.genre_ids or []):
            genre_count[gid] = genre_count.get(gid, 0) + 1
            if user_rating >= 7:
                loved_genre_count[gid] = loved_genre_count.get(gid, 0) + 1
        if key in cast_sample_keys:
            for c in (row.top_cast or []):
                actor_id = c["id"]
                entry = cast_count.get(actor_id, {"name": c["name"], "count": 0})
                entry["count"] += 1
                cast_count[actor_id] = entry

    top_genres = sorted(genre_count, key=lambda g: -genre_count[g])[:3]
    top_loved_genres = sorted(loved_genre_count, key=lambda g: -loved_genre_count[g])[:2]
    top_actors = sorted(cast_count.items(), key=lambda x: -x[1]["count"])[:3]

    # Seeds for "Because you watched X"
    by_rating = sorted_watched[:3]
    by_recency_ids = {f"{w.media_type}-{w.media_id}" for w in by_rating}
    by_recency = [
        w for w in sorted(watched, key=lambda w: -w.watched_at.timestamp())
        if f"{w.media_type}-{w.media_id}" not in by_recency_ids
    ][:2]
    because_source = by_rating + by_recency

    watched_set = {(w.media_id, w.media_type) for w in watched}
    seen = set()

    def filter_new(items):
        out = []
        for item in items:
            k = (item["id"], item["type"])
            if k in watched_set or k in seen:
                continue
            seen.add(k)
            out.append(item)
        return out

    sections = []

    # ── Fetch genre names ────────────────────────────────────────────────────
    try:
        genre_name_map = {
            **tmdb_client.get_genre_names("movie"),
            **tmdb_client.get_genre_names("tv"),
        }
    except TypeError:
        genre_name_map = {}

    def discover_mixed(genre_id):
        mov, tv = [], []
        with contextlib.suppress(requests.RequestException, ValueError):
            mov = [_tmdb_item(r, "movie") for r in tmdb_client.discover("movie", [genre_id])]
        with contextlib.suppress(requests.RequestException, ValueError):
            tv = [_tmdb_item(r, "tv") for r in tmdb_client.discover("tv", [genre_id])]
        return _interleave(mov, tv)

    # ── 1. More like what you love ───────────────────────────────────────────
    if top_loved_genres:
        with ThreadPoolExecutor(max_workers=4) as ex:
            loved_results = list(ex.map(discover_mixed, top_loved_genres))
        loved_items = filter_new(
            [item for sublist in loved_results for item in sublist]
        )[:12]
        if loved_items:
            sections.append({"key": "loved", "label": "More like what you love", "items": loved_items})

    # ── 2. Trending This Week ─────────────────────────────────────────────────
    try:
        trending_data = tmdb_client._get("/trending/all/week")
        trending_items = filter_new([
            _tmdb_item(r, r.get("media_type"))
            for r in trending_data.get("results", [])
            if r.get("media_type") in ("movie", "tv")
        ])[:12]
        if trending_items:
            sections.append({"key": "trending", "label": "Trending This Week", "items": trending_items})
    except (requests.RequestException, ValueError):
        pass

    # ── 3. Genre sections ─────────────────────────────────────────────────────
    with ThreadPoolExecutor(max_workers=6) as ex:
        genre_results = list(ex.map(discover_mixed, top_genres))
    for genre_id, items in zip(top_genres, genre_results, strict=False):
        filtered = filter_new(items)[:12]
        if filtered:
            genre_name = genre_name_map.get(genre_id, f"Genre {genre_id}")
            sections.append({
                "key": f"genre-{genre_id}",
                "label": f"Based on your taste in {genre_name}",
                "items": filtered,
            })

    # ── 4. Because you watched X ──────────────────────────────────────────────
    def fetch_similar(w):
        try:
            if w.media_type == "movie":
                data = tmdb_client._get(f"/movie/{w.media_id}/similar")
            else:
                data = tmdb_client._get(f"/tv/{w.media_id}/recommendations")
            return w, [_tmdb_item(r, w.media_type) for r in data.get("results", [])]
        except (requests.RequestException, ValueError):
            return w, []

    with ThreadPoolExecutor(max_workers=5) as ex:
        because_results = list(ex.map(fetch_similar, because_source))
    for w, items in because_results:
        filtered = filter_new(items)[:12]
        if filtered:
            sections.append({
                # Movie and TV ids overlap, so the type is part of the key.
                "key": f"because-{w.media_type}-{w.media_id}",
                "label": f"Because you watched {w.title}",
                "items": filtered,
            })

    # ── 5. Hidden Gems ────────────────────────────────────────────────────────
    def fetch_gems(media_type):
        try:
            return [_tmdb_item(r, media_type) for r in tmdb_client._get(
                f"/discover/{media_type}",
                {
                    "sort_by": "vote_average.desc",
                    "vote_average.gte": 7.5,
                    "vote_count.gte": 50,
                    "vote_count.lte": 1500,
                }
            ).get("results", [])]
        except (requests.RequestException, ValueError):
            return []

    with ThreadPoolExecutor(max_workers=2) as ex:
        gems_results = list(ex.map(fetch_gems, ["movie", "tv"]))
    gems_mov = filter_new(_interleave(*gems_results))[:12]
    if gems_mov:
        sections.append({"key": "hidden-gems", "label": "Hidden Gems", "items": gems_mov})

    # ── 6. Because you like [Actor] ───────────────────────────────────────────
    def fetch_actor_credits(actor_tuple):
        actor_id, info = actor_tuple
        try:
            data = tmdb_client._get(f"/person/{actor_id}/combined_credits")
            items = [
                _tmdb_item(c, c.get("media_type"))
                for c in data.get("cast", [])
                if c.get("media_type") in ("movie", "tv") and (c.get("vote_average") or 0) >= 6
            ]
            items.sort(key=lambda x: -x["voteAverage"])
            return actor_id, info["name"], items
        except (requests.RequestException, ValueError):
            return actor_id, info["name"], []

    with ThreadPoolExecutor(max_workers=3) as ex:
        actor_results = list(ex.map(fetch_actor_credits, top_actors))
    for actor_id, name, items in actor_results:
        filtered = filter_new(items)[:12]
        if filtered:
            sections.append({
                "key": f"actor-{actor_id}",
                "label": f"Because you like {name}",
                "items": filtered,
            })

    return sections


def _add_or_merge_section(sections, section, limit=12):
    """Append `section`, or merge its items into an existing one with the same
    label. Two KMeans clusters can resolve to the same top genres, which used
    to show the same "Your Taste: …" row twice."""
    existing = next((s for s in sections if s["label"] == section["label"]), None)
    if existing is None:
        sections.append(section)
        return
    have = {(i["id"], i["type"]) for i in existing["items"]}
    existing["items"] = (existing["items"] + [i for i in section["items"] if (i["id"], i["type"]) not in have])[:limit]


def _compute_personalized(user) -> list:
    """Compute personalized recommendation sections for a user. Returns list of sections."""
    watched = list(WatchedEntry.objects.filter(user=user))
    if len(watched) < 3:
        return []

    rating_map = {
        f"{r.media_type}-{r.media_id}": r.user_rating
        for r in RatingEntry.objects.filter(user=user)
    }

    # --- Fill missing genres first (clustering needs them); updates entries in place ---
    backfill_entries(watched)

    # --- Build genre vocabulary ---
    all_genre_ids = sorted({g for entry in watched for g in (entry.genre_ids or [])})
    if not all_genre_ids:
        return []
    genre_index = {g: i for i, g in enumerate(all_genre_ids)}
    n_genres = len(all_genre_ids)

    # --- Build rating-weighted feature matrix (N_items x N_genres) ---
    X = np.zeros((len(watched), n_genres))
    for i, entry in enumerate(watched):
        key = f"{entry.media_type}-{entry.media_id}"
        weight = rating_map.get(key, 5.0) / 10.0  # default 0.5 if unrated
        for g in (entry.genre_ids or []):
            if g in genre_index:
                X[i, genre_index[g]] = weight

    # --- K-Means: k scales with watchlist size ---
    k = max(2, min(4, len(watched) // 3))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X)
    centroids = kmeans.cluster_centers_  # (k, n_genres)

    # --- Fetch genre name maps ---
    try:
        genre_name_map = {**tmdb_client.get_genre_names("movie"), **tmdb_client.get_genre_names("tv")}
    except TypeError:
        genre_name_map = {}

    watched_set = {(e.media_id, e.media_type) for e in watched}
    seen = set()
    sections = []

    for cluster_idx in range(k):
        centroid = centroids[cluster_idx]

        # Top 2 genres by centroid weight
        top_indices = np.argsort(centroid)[::-1][:2]
        top_genre_ids = [all_genre_ids[i] for i in top_indices if centroid[i] > 0]
        if not top_genre_ids:
            continue

        label = "Your Taste: " + " & ".join(
            genre_name_map.get(g, str(g)) for g in top_genre_ids
        )

        # Fetch candidates from TMDB Discover (movie + tv)
        candidates = []
        for media_type in ("movie", "tv"):
            try:
                results = tmdb_client.discover(media_type, top_genre_ids)
            except (requests.RequestException, ValueError):
                results = []
            for r in results:
                mid = r.get("id")
                key = (mid, media_type)
                if key in watched_set or key in seen:
                    continue
                seen.add(key)
                candidates.append({
                    "id": mid,
                    "type": media_type,
                    "title": r.get("title") or r.get("name", ""),
                    "posterPath": r.get("poster_path"),
                    "voteAverage": r.get("vote_average", 0),
                    "popularity": r.get("popularity", 0),
                    "genre_ids": r.get("genre_ids", []),
                })

        if not candidates:
            continue

        # Score: 0.5 * genre_cosine_sim + 0.3 * norm_vote + 0.2 * (1 - norm_pop)
        max_pop = max((c["popularity"] for c in candidates), default=1) or 1
        scored = []
        for c in candidates:
            c_vec = np.zeros(n_genres)
            for g in c["genre_ids"]:
                if g in genre_index:
                    c_vec[genre_index[g]] = 1.0
            sim = (
                float(cosine_similarity(c_vec.reshape(1, -1), centroid.reshape(1, -1))[0][0])
                if c_vec.sum() > 0 and centroid.sum() > 0
                else 0.0
            )
            norm_vote = c["voteAverage"] / 10.0
            norm_pop = min(c["popularity"] / max_pop, 1.0)
            score = 0.5 * sim + 0.3 * norm_vote + 0.2 * (1.0 - norm_pop)
            scored.append((score, c))

        scored.sort(key=lambda x: x[0], reverse=True)
        items = [
            {k: v for k, v in c.items() if k != "genre_ids"}
            for _, c in scored[:12]
        ]

        _add_or_merge_section(sections, {"key": f"cluster-{cluster_idx}", "label": label, "items": items})

    return sections


def _refresh_cache_by_id(user_id):
    """Background-thread target: load the user fresh, exit quietly if they're gone."""
    try:
        user = User.objects.filter(pk=user_id).first()
    except DBError as e:
        # Outside _refresh_cache's try/finally: without this, one DB blip leaves
        # user_id in _computing_users for the life of the process ("pending" forever).
        logger.warning("Rec cache refresh could not load user %s: %s", user_id, e)
        _finish_refresh(user_id)
        return
    if user is None:
        _finish_refresh(user_id)
        return
    _refresh_cache(user)


def _finish_refresh(user_id):
    """Release user_id's in-flight slot, or hand it to one queued follow-up run."""
    with _computing_lock:
        if user_id in _rerun_users:
            _rerun_users.discard(user_id)
            rerun = True  # stays in _computing_users for the follow-up
        else:
            _computing_users.discard(user_id)
            rerun = False
    if rerun:
        _spawn_refresh(user_id)


def _refresh_cache(user):
    """Recompute both recommendation types and save to DB. Safe to run in background thread."""
    try:
        for_you = _compute_for_you(user)
        personalized = _compute_personalized(user)
        UserRecommendationCache.objects.update_or_create(
            user=user,
            defaults={"for_you_json": for_you, "personalized_json": personalized},
        )
        logger.info("Recommendation cache refreshed for user %s", user.id)
    except Exception as e:
        # Broad on purpose: this spans TMDB I/O, numpy/sklearn computation,
        # and a DB write in one background thread with no caller to report
        # to — insulating the whole pipeline from any unexpected bug matters
        # more here than precise typing, since an uncaught exception would
        # just silently kill the thread with no visible error.
        logger.warning("Rec cache refresh failed for user %s: %s", user.id, e)
    finally:
        _finish_refresh(user.id)


def _is_stale(cache) -> bool:
    return (timezone.now() - cache.computed_at).total_seconds() > RECOMMENDATIONS_TTL_HOURS * 3600


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommendations_for_you(request):
    cache = UserRecommendationCache.objects.filter(user=request.user).first()
    if cache:
        if _is_stale(cache):
            _start_refresh_if_needed(request.user)
        computing = request.user.id in _computing_users
        return Response({"status": "pending" if computing else "ready", "sections": cache.for_you_json})
    _start_refresh_if_needed(request.user)
    return Response({"status": "pending", "sections": []})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def personalized_recommendations(request):
    cache = UserRecommendationCache.objects.filter(user=request.user).first()
    if cache:
        if _is_stale(cache):
            _start_refresh_if_needed(request.user)
        computing = request.user.id in _computing_users
        return Response({"status": "pending" if computing else "ready", "sections": cache.personalized_json})
    _start_refresh_if_needed(request.user)
    return Response({"status": "pending", "sections": []})
