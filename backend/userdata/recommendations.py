import logging
import random
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from functools import partial

import numpy as np
import requests
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import IntegrityError, connection, transaction
from django.db import Error as DBError
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity

from . import genre_families, tmdb_budget, tmdb_client
from .metadata_backfill import backfill_entries
from .social_views import is_talk_or_news
from .models import CACHE_TTL_DAYS, RatingEntry, TMDBMediaCache, UserRecommendationCache, WatchedEntry

logger = logging.getLogger(__name__)

# One refresh fetches at most this many titles' details (missing first, then
# the oldest cached); the rest wait for later runs. A 50k-title import used to
# mean ~50k server-key TMDB calls in one refresh.
MAX_FILL_PER_RUN = 200
# Cached rows are looked up per media type in chunks of this many ids, not with
# one OR'd condition per watched title.
_LOOKUP_CHUNK = 1000
RECOMMENDATIONS_TTL_HOURS = 12
# How long a refreshing_since stamp counts as "still running". Well above a
# normal refresh, so a killed process's stamp expires on its own.
REFRESH_STATUS_WINDOW = timedelta(minutes=10)
# After a refresh whose result was refused (TMDB failed), polls don't start
# another one for this long: every 3 s poll of the still-stale row used to
# start a full recompute, on every process. A data change still refreshes.
REFRESH_FAILURE_BACKOFF = 10 * 60

_computing_lock = threading.Lock()
_computing_users = set()  # user ids currently being (re)computed, in-process only
_rerun_users = set()  # in-flight user ids that got another trigger; get one follow-up run
_own_stamp = {}  # user id -> the refreshing_since this process last wrote for its running refresh
# At most this many refreshes compute at once per process. Each holds a DB
# connection for minutes plus 10 HTTP workers; the rest wait (holding no
# connection yet) and run after.
MAX_CONCURRENT_REFRESHES = 4
_refresh_slots = threading.BoundedSemaphore(MAX_CONCURRENT_REFRESHES)


class FetchHealth:
    """Whether any TMDB call failed during one compute, shared by its worker threads."""

    def __init__(self):
        self._lock = threading.Lock()
        self.failed = False

    def mark_failed(self):
        with self._lock:
            self.failed = True


def _spawn_refresh(user_id):
    try:
        threading.Thread(target=_refresh_thread, args=(user_id,), daemon=True).start()
    except RuntimeError:
        # Can't start a thread (exhaustion): release the slot and the stamp,
        # or the user reads "pending" for the life of the process. A queued
        # follow-up is dropped too, so this can't loop.
        logger.exception("Could not start a recommendations refresh for user %s", user_id)
        with _computing_lock:
            _rerun_users.discard(user_id)
        _finish_refresh(user_id)


def _refresh_thread(user_id):
    """Thread target. Waits for one of MAX_CONCURRENT_REFRESHES slots, runs the
    refresh (which releases the user's in-flight state), then closes the
    thread's own DB connection so it isn't leaked."""
    try:
        with _refresh_slots:
            _refresh_cache_by_id(user_id)
    finally:
        connection.close()


def _set_refreshing_since(user_id, value, *, only_if=None):
    """Record (or clear) the cross-process "refresh running" stamp. Best-effort:
    a DB error only costs an accurate status, never the refresh itself.
    With `only_if`, change it only while it still holds exactly that stamp."""
    qs = UserRecommendationCache.objects.filter(user_id=user_id)
    if only_if is not None:
        qs = qs.filter(refreshing_since=only_if)
    try:
        qs.update(refreshing_since=value)
    except DBError as e:
        logger.warning("Could not update refresh status for user %s: %s", user_id, e)


def _backoff_key(user_id):
    return f"rec_refresh_backoff:{user_id}"


def in_failure_backoff(user_id):
    """A refresh for user_id was refused within REFRESH_FAILURE_BACKOFF.
    Lives in `default` (shared by every process): a plain set with a timeout,
    never `incr`, so losing it in a cull only allows one early retry."""
    return cache.get(_backoff_key(user_id)) is not None


def request_refresh(user_id, *, rerun_if_running):
    """Schedule a background refresh for user_id, coalesced per user.

    At most one refresh runs per user at a time. If one is already running and
    rerun_if_running is set (the data changed, so its result will be stale),
    exactly one follow-up run is queued no matter how many triggers arrive.
    A data-change trigger (rerun_if_running) also ends a failure backoff.
    """
    if rerun_if_running:
        cache.delete(_backoff_key(user_id))
    with _computing_lock:
        if user_id in _computing_users:
            if rerun_if_running:
                _rerun_users.add(user_id)
            return
        _computing_users.add(user_id)
    # No-op without a row yet; the endpoints already answer "pending" then.
    _stamp_refresh(user_id)
    _spawn_refresh(user_id)


def _stamp_refresh(user_id):
    """Stamp the row as refreshing, remembering the stamp so this run's finish
    clears only its own and never one another process wrote since."""
    stamp = timezone.now()
    with _computing_lock:
        _own_stamp[user_id] = stamp
    _set_refreshing_since(user_id, stamp)


def _start_refresh_if_needed(user):
    """Start a background refresh for user unless one is already running. Returns True if now computing."""
    request_refresh(user.id, rerun_if_running=False)
    return True


def _is_fresh(cached):
    return cached is not None and cached.cached_at >= timezone.now() - timedelta(days=CACHE_TTL_DAYS)


def _fetch_media_details(entry, health=None):
    """Worker-thread half of the cache fill: TMDB HTTP only, no DB. Returns
    the details, empty details when TMDB says the title doesn't exist (a
    settled answer, cached like any other), or None on failure."""
    try:
        return tmdb_client.get_details_with_cast(entry.media_id, entry.media_type)
    except (requests.RequestException, KeyError, TypeError, ValueError) as e:
        if tmdb_client.is_not_found(e):
            logger.info("TMDB has no %s %s; caching it as empty", entry.media_type, entry.media_id)
            return {"genre_ids": [], "top_cast": []}
        logger.warning("TMDB cache fetch failed for %s %s: %s", entry.media_type, entry.media_id, e)
        if health is not None:
            health.mark_failed()
        return None


def _store_media_cache(entry, details, cached):
    """Calling-thread half of the cache fill: upsert `details`, else keep `cached`.

    Never cache a failure: writing empty genres/cast here used to replace good
    data and hide the title for a whole CACHE_TTL_DAYS. With no details, keep
    any existing (even stale) row; with none, store nothing so the next run
    retries. A TMDB 404 is not a failure: it arrives as empty details and is
    stored, so the title isn't refetched every run.
    """
    if details is None:
        return cached
    try:
        cached, _ = TMDBMediaCache.objects.update_or_create(
            media_id=entry.media_id,
            media_type=entry.media_type,
            defaults={"genre_ids": details["genre_ids"], "top_cast": details["top_cast"]},
        )
    except IntegrityError:
        # Another process won the race — just read what it wrote
        cached = TMDBMediaCache.objects.filter(
            media_id=entry.media_id, media_type=entry.media_type
        ).first()
    return cached


def _ensure_cached(entry, prefetched=None):
    """Return a TMDBMediaCache row for entry, fetching from TMDB if stale/missing.

    Single-entry, single-thread version; loops use _fill_media_cache.
    `prefetched` is an optional {(media_id, media_type): row} dict built with a
    single bulk query, to avoid one DB lookup per entry when called from a loop.
    """
    if prefetched is not None:
        cached = prefetched.get((entry.media_id, entry.media_type))
    else:
        cached = TMDBMediaCache.objects.filter(
            media_id=entry.media_id, media_type=entry.media_type
        ).first()
    if _is_fresh(cached):
        return cached
    return _store_media_cache(entry, _fetch_media_details(entry), cached)


def _cached_rows(entries):
    """{(media_id, media_type): TMDBMediaCache row} for the entries that have one."""
    ids_by_type = {}
    for e in entries:
        ids_by_type.setdefault(e.media_type, set()).add(e.media_id)
    rows = {}
    for media_type, ids in ids_by_type.items():
        ids = sorted(ids)
        for i in range(0, len(ids), _LOOKUP_CHUNK):
            for row in TMDBMediaCache.objects.filter(media_type=media_type, media_id__in=ids[i:i + _LOOKUP_CHUNK]):
                rows[(row.media_id, row.media_type)] = row
    return rows


def _fill_media_cache(entries, health=None):
    """{(media_id, media_type): TMDBMediaCache row or None} for entries.

    Fetches at most MAX_FILL_PER_RUN titles, within the user's daily title
    budget (tmdb_budget): never-cached titles first (newest watch first), then
    the oldest cached ones. A stale row that isn't refetched this run is still
    returned and used. Being capped is not a failure: only a failed fetch marks
    `health`.

    Pool workers only fetch from TMDB. Every DB read and write stays on the
    calling thread, so the workers never open (and leak) their own connections.
    """
    if not entries:
        return {}
    rows = _cached_rows(entries)
    missing, stale = [], []
    for e in entries:
        row = rows.get((e.media_id, e.media_type))
        if row is None:
            missing.append(e)
        elif not _is_fresh(row):
            stale.append(e)
    missing.sort(key=lambda e: (e.watched_at, e.pk), reverse=True)
    stale.sort(key=lambda e: rows[(e.media_id, e.media_type)].cached_at)
    todo = (missing + stale)[:MAX_FILL_PER_RUN]
    todo = todo[:tmdb_budget.take(entries[0].user_id, len(todo))]
    if todo:
        with ThreadPoolExecutor(max_workers=10) as ex:
            fetched = list(ex.map(partial(_fetch_media_details, health=health), todo))
        for entry, details in zip(todo, fetched, strict=True):
            key = (entry.media_id, entry.media_type)
            rows[key] = _store_media_cache(entry, details, rows.get(key))
    return rows


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


def _compute_for_you(user, health=None) -> list:
    """Compute for-you recommendation sections for a user. Returns list of sections.

    TMDB failures that can drop content are recorded on `health`.
    """
    health = health or FetchHealth()
    watched = list(WatchedEntry.objects.filter(user=user))
    if not watched:
        return []

    ratings = list(RatingEntry.objects.filter(user=user))
    rating_map = {f"{r.media_type}-{r.media_id}": r.user_rating for r in ratings}

    # ── Cache: bulk-prefetch existing rows, then parallel fetch/refresh ──────
    cache_by_key = {
        f"{row.media_type}-{row.media_id}": row
        for row in _fill_media_cache(watched, health).values() if row
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
        # Families, not raw ids: a movie's Action (28) and a show's Action &
        # Adventure (10759) are one taste (genre_families).
        for family in genre_families.families(row.genre_ids, w.media_type):
            genre_count[family] = genre_count.get(family, 0) + 1
            if user_rating >= 7:
                loved_genre_count[family] = loved_genre_count.get(family, 0) + 1
        if key in cast_sample_keys:
            for c in (row.top_cast or []):
                actor_id = c["id"]
                entry = cast_count.get(actor_id, {"name": c["name"], "count": 0})
                entry["count"] += 1
                cast_count[actor_id] = entry

    top_genres = sorted(genre_count, key=lambda g: -genre_count[g])[:3]
    top_loved_genres = sorted(loved_genre_count, key=lambda g: -loved_genre_count[g])[:2]
    top_actors = sorted(cast_count.items(), key=lambda x: -x[1]["count"])[:3]

    # Seeds for "Because you watched X". A title the user rated 4 or below
    # never seeds one; unrated titles stay eligible.
    def liked_enough(w):
        rating = rating_map.get(f"{w.media_type}-{w.media_id}")
        return rating is None or rating > 4

    by_rating = [w for w in sorted_watched if liked_enough(w)][:3]
    by_recency_ids = {f"{w.media_type}-{w.media_id}" for w in by_rating}
    by_recency = [
        w for w in sorted(watched, key=lambda w: -w.watched_at.timestamp())
        if f"{w.media_type}-{w.media_id}" not in by_recency_ids and liked_enough(w)
    ][:2]
    because_source = by_rating + by_recency

    # A rated title counts as seen even if it was never marked watched.
    watched_set = {(w.media_id, w.media_type) for w in watched} | {(r.media_id, r.media_type) for r in ratings}
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

    def discover_mixed(family):
        # Each type gets its own ids for the family; a type without the genre
        # (Horror on TV) isn't asked at all.
        found = {"movie": [], "tv": []}
        for media_type in ("movie", "tv"):
            genres = genre_families.with_genres(media_type, [family])
            if genres is None:
                continue
            try:
                found[media_type] = [_tmdb_item(r, media_type) for r in tmdb_client.discover(media_type, genres)]
            except (requests.RequestException, ValueError):
                health.mark_failed()
        return _interleave(found["movie"], found["tv"])

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
        health.mark_failed()

    # ── 3. Genre sections ─────────────────────────────────────────────────────
    with ThreadPoolExecutor(max_workers=6) as ex:
        genre_results = list(ex.map(discover_mixed, top_genres))
    for family, items in zip(top_genres, genre_results, strict=False):
        filtered = filter_new(items)[:12]
        if filtered:
            genre_name = genre_families.family_name(family, genre_name_map)
            sections.append({
                "key": f"genre-{family}",
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
        except (requests.RequestException, ValueError) as e:
            # A title TMDB no longer has just yields no section.
            if not tmdb_client.is_not_found(e):
                health.mark_failed()
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
            health.mark_failed()
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
                # Talk shows and news: the actor as themselves, not their work.
                and not is_talk_or_news(c)
            ]
            items.sort(key=lambda x: -x["voteAverage"])
            return actor_id, info["name"], items
        except (requests.RequestException, ValueError) as e:
            # Actor ids come from cached top_cast, so a merged or deleted
            # person keeps 404ing: that's no section, not an outage.
            if not tmdb_client.is_not_found(e):
                health.mark_failed()
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


def _genres_for(media_type, families):
    """`with_genres` for the families together, else for each family alone
    (top one first). Horror (movies only) + Reality (TV only) can't be asked
    as a pair of either type; this asks movies for Horror and TV for Reality."""
    for keys in (families, *([f] for f in families)):
        genres = genre_families.with_genres(media_type, keys)
        if genres is not None:
            return genres
    return None


def _compute_personalized(user, health=None) -> list:
    """Compute personalized recommendation sections for a user. Returns list of sections.

    TMDB failures that can drop content are recorded on `health`.
    """
    health = health or FetchHealth()
    watched = list(WatchedEntry.objects.filter(user=user))
    if len(watched) < 3:
        return []

    ratings = list(RatingEntry.objects.filter(user=user))
    rating_map = {f"{r.media_type}-{r.media_id}": r.user_rating for r in ratings}

    # --- Fill missing genres first (clustering needs them); updates entries in place ---
    # Titles left genre-less by a TMDB failure would skew the clusters, so the
    # result must not replace a good stored one (save_recommendations).
    if not backfill_entries(watched):
        health.mark_failed()

    # --- Rows: titles with genres the user didn't dislike ---
    # A genre-less title is a zero vector that drags every centroid toward the
    # origin; a title rated 4 or below would still add positive weight to its
    # genres ("Your Taste: Horror" from horror rated 1-2). Neither is taste.
    usable = []
    for entry in watched:
        fams = genre_families.families(entry.genre_ids, entry.media_type)
        rating = rating_map.get(f"{entry.media_type}-{entry.media_id}")
        if fams and (rating is None or rating > 4):
            usable.append((entry, fams, rating))
    if len(usable) < 3:
        return []

    # --- Build genre vocabulary: families, so movie and TV ids line up ---
    all_families = sorted({f for _, fams, _ in usable for f in fams})
    genre_index = {f: i for i, f in enumerate(all_families)}
    n_genres = len(all_families)

    # --- Build rating-weighted feature matrix (N_items x N_genres) ---
    X = np.zeros((len(usable), n_genres))
    for i, (_, fams, rating) in enumerate(usable):
        weight = (rating if rating is not None else 5.0) / 10.0  # default 0.5 if unrated
        for f in fams:
            X[i, genre_index[f]] = weight

    # --- K-Means: k scales with the usable history ---
    k = max(2, min(4, len(usable) // 3))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X)
    centroids = kmeans.cluster_centers_  # (k, n_genres)

    # --- Fetch genre name maps ---
    try:
        genre_name_map = {**tmdb_client.get_genre_names("movie"), **tmdb_client.get_genre_names("tv")}
    except TypeError:
        genre_name_map = {}

    # Every watched or rated title is excluded, dropped rows included.
    watched_set = {(e.media_id, e.media_type) for e in watched} | {(r.media_id, r.media_type) for r in ratings}
    seen = set()
    sections = []

    for cluster_idx in range(k):
        centroid = centroids[cluster_idx]

        # Top 2 genres by centroid weight
        top_indices = np.argsort(centroid)[::-1][:2]
        top_families = [all_families[i] for i in top_indices if centroid[i] > 0]
        if not top_families:
            continue

        label = "Your Taste: " + " & ".join(
            genre_families.family_name(f, genre_name_map) for f in top_families
        )

        # Fetch candidates from TMDB Discover (movie + tv)
        candidates = []
        for media_type in ("movie", "tv"):
            genres = _genres_for(media_type, top_families)
            if genres is None:
                continue
            try:
                results = tmdb_client.discover(media_type, genres)
            except (requests.RequestException, ValueError):
                health.mark_failed()
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
                    "families": genre_families.families(r.get("genre_ids", []), media_type),
                })

        if not candidates:
            continue

        # Score: 0.5 * genre_cosine_sim + 0.3 * norm_vote + 0.2 * (1 - norm_pop)
        max_pop = max((c["popularity"] for c in candidates), default=1) or 1
        scored = []
        for c in candidates:
            c_vec = np.zeros(n_genres)
            for f in c["families"]:
                if f in genre_index:
                    c_vec[genre_index[f]] = 1.0
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
            {k: v for k, v in c.items() if k != "families"}
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
            own = None
        else:
            _computing_users.discard(user_id)
            rerun = False
            own = _own_stamp.pop(user_id, None)
    if rerun:
        # A fresh stamp, so a long chain of follow-ups can't age past
        # REFRESH_STATUS_WINDOW and read as a killed run.
        _stamp_refresh(user_id)
        _spawn_refresh(user_id)
    elif own is not None:
        # Exact match: a refresh another process started meanwhile overwrote
        # the stamp, and it keeps reporting "pending" until it finishes.
        _set_refreshing_since(user_id, None, only_if=own)


def _non_empty_sections(*section_lists):
    return sum(1 for sections in section_lists for s in (sections or []) if s.get("items"))


SAVED, KEPT_OUTAGE, SUPERSEDED = "saved", "kept_outage", "superseded"
# First key of save_recommendations' per-user advisory lock (pg's two-int form,
# second key the user id), so it can't collide with other advisory locks.
SAVE_LOCK_NAMESPACE = 7311


def save_recommendations(user, for_you, personalized, health, started=None):
    """Store a computed result unless a TMDB outage made it lose content, or a
    compute that started later has already stored its own.

    When a TMDB call failed and the result has fewer non-empty sections than
    the stored row, or none at all, the stored row stays untouched (with no
    row, nothing is written) and a later refresh retries: KEPT_OUTAGE.
    With `started` (when this compute began), a stored row from a compute that
    began later is kept (SUPERSEDED, not a failure): two processes can each
    refresh one user. A clean, current compute writes: SAVED.
    """
    with transaction.atomic():
        # Serializes this user's saves even before a row exists to lock (a
        # first compute): row locks alone let two first saves both pass. Both
        # checks below read the row under it, so a save landing in between
        # can't be overwritten by an outage result.
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s, %s)", [SAVE_LOCK_NAMESPACE, user.id])
        stored = UserRecommendationCache.objects.select_for_update().filter(user=user).first()
        if health.failed:
            new_count = _non_empty_sections(for_you, personalized)
            old_count = _non_empty_sections(stored.for_you_json, stored.personalized_json) if stored else 0
            if new_count == 0 or new_count < old_count:
                logger.warning(
                    "Rec cache refresh for user %s kept the previous result: TMDB failed (%s -> %s sections)",
                    user.id, old_count, new_count,
                )
                return KEPT_OUTAGE
        if (
            started is not None and stored is not None
            and stored.source_started_at is not None and stored.source_started_at > started
        ):
            logger.info("Rec cache refresh for user %s superseded by a newer compute", user.id)
            return SUPERSEDED
        defaults = {"for_you_json": for_you, "personalized_json": personalized}
        if started is not None:
            defaults["source_started_at"] = started
        UserRecommendationCache.objects.update_or_create(user=user, defaults=defaults)
    return SAVED


def _refresh_cache(user):
    """Recompute both recommendation types and save to DB. Safe to run in background thread."""
    try:
        started = timezone.now()
        health = FetchHealth()
        for_you = _compute_for_you(user, health)
        personalized = _compute_personalized(user, health)
        outcome = save_recommendations(user, for_you, personalized, health, started=started)
        if outcome == SAVED:
            logger.info("Recommendation cache refreshed for user %s", user.id)
        elif outcome == KEPT_OUTAGE:
            # Only an outage backs off; being superseded isn't a failure.
            cache.set(_backoff_key(user.id), 1, REFRESH_FAILURE_BACKOFF)
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


def _is_refreshing(user_id, cache) -> bool:
    """A refresh is running in this process, or recently started on any process."""
    if user_id in _computing_users:
        return True
    since = cache.refreshing_since
    return since is not None and timezone.now() - since < REFRESH_STATUS_WINDOW


def _recommendations_response(user, sections_of):
    """Shared by both endpoints. A stale row starts a refresh, unless a recent
    one was refused (failure backoff): then the stored result is served as is."""
    cache_row = UserRecommendationCache.objects.filter(user=user).first()
    if cache_row:
        if _is_stale(cache_row) and not in_failure_backoff(user.id):
            _start_refresh_if_needed(user)
        computing = _is_refreshing(user.id, cache_row)
        return Response({"status": "pending" if computing else "ready", "sections": sections_of(cache_row)})
    if not in_failure_backoff(user.id):
        _start_refresh_if_needed(user)
    return Response({"status": "pending", "sections": []})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommendations_for_you(request):
    return _recommendations_response(request.user, lambda row: row.for_you_json)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def personalized_recommendations(request):
    return _recommendations_response(request.user, lambda row: row.personalized_json)
