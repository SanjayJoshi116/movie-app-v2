import logging
import math
import threading
import time
from collections import deque
from datetime import date, datetime, timedelta
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

import requests
from django.core.cache import caches
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from . import library_limits
from .bulk_import import bulk_import, timestamp_or_now
from .models import EpisodeProgress, FollowedPerson, WatchedEntry
from .pagination import DefaultPagination
from .serializers import (
    INT32_MAX,
    BulkEpisodeProgressSerializer,
    BulkFollowedPersonSerializer,
    EpisodeProgressInputSerializer,
    FollowPersonInputSerializer,
)
from . import tmdb_client

logger = logging.getLogger(__name__)


def _progress_data(prog):
    return {"showId": prog.show_id, "season": prog.season_number, "episode": prog.episode_number}


def _follow_data(fp):
    return {"id": fp.id, "personId": fp.person_id, "name": fp.name, "profilePath": fp.profile_path,
            "followedAt": fp.followed_at}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def episode_progress_list(request):
    """Every show's progress, for the backup export."""
    rows = EpisodeProgress.objects.filter(user=request.user).order_by("-updated_at", "-id")
    paginator = DefaultPagination()
    page = paginator.paginate_queryset(rows, request)
    return paginator.get_paginated_response(
        [{**_progress_data(p), "updatedAt": p.updated_at} for p in page]
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def episode_progress_bulk(request):
    """Create-only restore: a show the user already tracks keeps its progress."""

    def build(user, _media_type, item):
        return EpisodeProgress(
            user=user, show_id=item["showId"], season_number=item["season"], episode_number=item["episode"],
        )

    return bulk_import(
        request, model=EpisodeProgress, entry_serializer=BulkEpisodeProgressSerializer, build=build,
        identity=("showId", "show_id"), limit="episode_progress",
    )


@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def episode_progress(request, show_id: int):
    if request.method == "GET":
        try:
            prog = EpisodeProgress.objects.get(user=request.user, show_id=show_id)
            return Response(_progress_data(prog))
        except EpisodeProgress.DoesNotExist:
            return Response(None)

    if request.method == "DELETE":
        EpisodeProgress.objects.filter(user=request.user, show_id=show_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # The path converter accepts any digits; an id past `integer` range would
    # be a DataError on insert. Reads/deletes above just match nothing.
    if not 1 <= show_id <= INT32_MAX:
        return Response({"detail": "Invalid show id."}, status=status.HTTP_400_BAD_REQUEST)
    body = EpisodeProgressInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    season = body.validated_data["season"]
    episode = body.validated_data["episode"]

    # A show already tracked just moves on; a new one needs room under the limit.
    prog, created = library_limits.get_or_create(
        "episode_progress", request.user.id, request.user.episode_progress,  # related manager: sets user
        identity={"show_id": show_id}, defaults={"season_number": season, "episode_number": episode},
    )
    if not created:
        prog.season_number, prog.episode_number = season, episode
        prog.save(update_fields=["season_number", "episode_number", "updated_at"])
    return Response(_progress_data(prog))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def followed_people_list(request):
    if request.method == "GET":
        people = FollowedPerson.objects.filter(user=request.user).order_by("-followed_at", "-id")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(people, request)
        return paginator.get_paginated_response([_follow_data(p) for p in page])

    body = FollowPersonInputSerializer(data=request.data)
    body.is_valid(raise_exception=True)
    # A missing id keeps its own message (test_input_validation pins it).
    if not body.validated_data.get("personId"):
        return Response({"detail": "personId is required."}, status=status.HTTP_400_BAD_REQUEST)
    fp, created = library_limits.get_or_create(
        "followed", request.user.id, request.user.followed_people,  # related manager: sets user
        identity={"person_id": body.validated_data["personId"]},
        defaults={"name": body.validated_data["name"], "profile_path": body.validated_data.get("profilePath")},
    )
    return Response(_follow_data(fp), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def followed_people_bulk(request):
    """Create-only restore that keeps each follow's original time."""

    def build(user, _media_type, item):
        return FollowedPerson(
            user=user, person_id=item["personId"], name=item["name"],
            profile_path=item.get("profilePath"), followed_at=timestamp_or_now(item.get("followedAt")),
        )

    return bulk_import(
        request, model=FollowedPerson, entry_serializer=BulkFollowedPersonSerializer, build=build,
        identity=("personId", "person_id"), limit="followed",
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


PERSON_CREDITS_TTL = 6 * 60 * 60
# Wall-clock cap on the followed-people recommendations' TMDB fetches (up to 10
# cold people). Must stay well under gunicorn's --timeout
# (docker-entrypoint.sh); test_followed_people pins the margin.
FOLLOWED_RECS_BUDGET_SECONDS = 15
# Talk shows and news: a person appearing as themselves, not their work.
TALK_AND_NEWS_GENRES = {10767, 10763}
# "New from {name}" reads a person's titles dated this far back, or later.
NEW_WORK_DAYS = 730


# A person's summary keeps only credits dated this close to "now" (UTC, at
# fetch time): notifications look 30 days back in the device's zone (at most a
# day from UTC) and a summary is at most PERSON_CREDITS_TTL old, so these
# margins cover every poll that can read it, a title dated tomorrow included.
RECENT_PAST_DAYS = 32
RECENT_FUTURE_DAYS = 2


def credits_cache():
    """Person credits have their own cache alias (settings.PERSON_CREDITS_*):
    in `default` they culled throttle counters, in `tmdb` the proxy's entries."""
    return caches["person_credits"]


# Versioned: older entries (cast only, or stored before credits were cleaned)
# are never read. One prefix per person, so DatabaseCache's cull, which deletes
# keys in alphabetical order, removes a person's two entries together.
def _credits_key(person_id):
    return f"person:v3:{person_id}:new"


def _recent_key(person_id):
    return f"person:v3:{person_id}:recent"


def is_talk_or_news(credit):
    genre_ids = credit.get("genre_ids")
    return isinstance(genre_ids, list) and any(isinstance(g, int) and g in TALK_AND_NEWS_GENRES for g in genre_ids)


def credit_date(credit):
    """A cleaned credit's date (_clean_credit folds a show's first-air date
    into release_date), or None if missing or malformed."""
    value = credit.get("release_date")
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _recent_summary(cast, today: date):
    start = today - timedelta(days=RECENT_PAST_DAYS)
    end = today + timedelta(days=RECENT_FUTURE_DAYS)
    return [c for c in cast if (d := credit_date(c)) is not None and start <= d <= end]


def new_work(credits, today: date):
    """Credits dated within NEW_WORK_DAYS before `today`, or later; undated ones
    are left out. Also applied on read, so a list cached days ago stays right."""
    start = today - timedelta(days=NEW_WORK_DAYS)
    return [c for c in credits if (d := credit_date(c)) is not None and d >= start]


def cached_recent_credits(person_ids):
    """{person_id: recent summary} for the people whose summary is cached. Cache
    only, no TMDB call."""
    found = credits_cache().get_many([_recent_key(pid) for pid in person_ids])
    return {pid: found[_recent_key(pid)] for pid in person_ids if _recent_key(pid) in found}


def _clean_credit(c):
    """The fields notifications and "New from" read, from one TMDB credit, or
    None for a credit they can't show (not a movie or show, no usable id or
    title, a talk or news appearance). Cached entries hold only these, so the
    readers can trust their types."""
    if not isinstance(c, dict) or is_talk_or_news(c):
        return None
    cid, media_type = c.get("id"), c.get("media_type")
    title = c.get("title") or c.get("name")
    if type(cid) is not int or media_type not in ("movie", "tv") or not isinstance(title, str) or not title.strip():
        return None
    score = c.get("vote_average")
    usable_score = isinstance(score, (int, float)) and not isinstance(score, bool) and math.isfinite(score)
    return {
        "id": cid,
        "media_type": media_type,
        "title": title,
        "poster_path": c["poster_path"] if isinstance(c.get("poster_path"), str) else None,
        "release_date": c.get("release_date") or c.get("first_air_date"),
        "vote_average": float(score) if usable_score else 0,
    }


def _fetch_person_credits(person_id):
    """One person's work from TMDB: acting and every crew job, one entry per
    (id, media_type), cleaned and trimmed (_clean_credit). Raises on failure,
    an answer whose credit lists aren't lists included. No DB or cache access,
    so it's safe in a worker thread (the production cache is DB-backed; worker
    threads would each open and leak a connection)."""
    data = tmdb_client._get(f"/person/{person_id}/combined_credits")
    cast, crew = data.get("cast") or [], data.get("crew") or []
    if not isinstance(cast, list) or not isinstance(crew, list):
        raise ValueError("TMDB credits aren't lists")
    seen = set()
    out = []
    for c in map(_clean_credit, [*cast, *crew]):
        if c is None or (c["id"], c["media_type"]) in seen:
            continue
        seen.add((c["id"], c["media_type"]))
        out.append(c)
    return out


def credit_item(c):
    """A cleaned credit in the client's item shape."""
    return {"id": c["id"], "type": c["media_type"], "title": c["title"], "posterPath": c["poster_path"],
            "voteAverage": c["vote_average"]}


# Followed people's credit fetches, for every request in this process: their
# own pool, so fetches left running past a request's deadline only ever delay
# each other, never the proxy or the deadline pool (rating sync, TMDB connect).
# At least the request threads (test_startup_warmup pins it).
FOLLOWED_POOL_SIZE = 16
FOLLOWED_POOL = ThreadPoolExecutor(max_workers=FOLLOWED_POOL_SIZE, thread_name_prefix="tmdb-followed")
# One call's fetches in flight at once, so one poll can't take the whole pool.
FETCHES_PER_CALL = 5

# Credits that arrived after their request stopped waiting: kept here by the
# worker (which must not touch the DB-backed cache) and cached by the next
# call, on its request thread. Bounded; new ones are dropped when full.
MAX_LATE_RESULTS = 200
_late_results = {}
_late_lock = threading.Lock()
# Fetches still running after their request gave up, removed once their
# result is kept, so a test's teardown can wait them out instead of one
# landing in the next test's late results.
_late_pending = set()


def _keep_late(future):
    keep = not future.cancelled() and future.exception() is None
    person_id, credits = future.result() if keep else (None, None)
    with _late_lock:
        # None: a failure, never stored, so it's retried.
        if credits is not None and len(_late_results) < MAX_LATE_RESULTS:
            _late_results[person_id] = credits
        _late_pending.discard(future)


def _take_late_results():
    with _late_lock:
        taken = dict(_late_results)
        _late_results.clear()
    return taken


def _store_credits(store, by_person, today):
    """Cache each person's new-work list and recent summary together, in one
    write; returns {cache key: value}."""
    entries = {}
    for person_id, credits in by_person.items():
        entries[_credits_key(person_id)] = new_work(credits, today)
        entries[_recent_key(person_id)] = _recent_summary(credits, today)
    if entries:
        store.set_many(entries, PERSON_CREDITS_TTL)
    return entries


def watched_keys(user, results):
    """{(media_id, media_type)} of the user's watched titles among the credits
    in `results` ([(FollowedPerson, credits)]): neither notifications nor "New
    from" show them. One query, on the request thread, for those ids only, not
    the whole history (up to 20,000 rows) on every poll."""
    ids = {c["id"] for _fp, credits in results for c in credits}
    if not ids:
        return set()
    return set(WatchedEntry.objects.filter(user=user, media_id__in=ids).values_list("media_id", "media_type"))


def _fetch_followed_people_credits(user, limit=None, max_fetch=None, budget_seconds=None, summary_only=False):
    """Fetch TMDB credits (acting and crew) for a user's followed people (all of them, or the
    `limit` most recently followed). Returns [(FollowedPerson, cast_list)];
    cast_list is [] for a person whose TMDB fetch failed (or wasn't fetched this
    call), so callers never need to special-case a failure separately from
    "no credits".

    Credits are cached per person (shared by every follower) for
    PERSON_CREDITS_TTL, each as soon as it arrives. Failures are never cached,
    so the next call retries; a TMDB 404 is cached as no credits. `max_fetch` caps how many uncached people one
    call fetches (in followed order, so the next call's first uncached ones are
    new people), and `budget_seconds` caps how long it waits for them. At the
    deadline, fetches not started yet are dropped, and ones still running
    finish on FOLLOWED_POOL and are cached by the next call (_keep_late).

    Without `summary_only` the lists are each person's new and upcoming work
    (new_work). With it, their recent summary (credits dated around now):
    notifications read only those,
    so a poll's load doesn't grow with how many credits people have. Both are
    written together on every fetch, so either caller's fetch serves the other."""
    followed = FollowedPerson.objects.filter(user=user).order_by("-followed_at", "-id")
    followed = list(followed[:limit] if limit is not None else followed)
    if not followed:
        return []

    key = _recent_key if summary_only else _credits_key
    store = credits_cache()
    today = timezone.now().date()
    _store_credits(store, _take_late_results(), today)
    wanted = {key(fp.person_id) for fp in followed}
    cached = store.get_many(list(wanted))
    to_fetch = list(dict.fromkeys(fp.person_id for fp in followed if key(fp.person_id) not in cached))
    if max_fetch is not None:
        to_fetch = to_fetch[:max_fetch]

    def fetch(person_id):
        try:
            return person_id, _fetch_person_credits(person_id)
        except (requests.RequestException, ValueError, TypeError, AttributeError) as e:
            if tmdb_client.is_not_found(e):
                # Settled: cached as "no credits", so a merged or deleted
                # person isn't refetched (and doesn't starve others) every poll.
                logger.warning("TMDB has no person %s; caching no credits", person_id)
                return person_id, []
            logger.exception("Failed to fetch combined credits for person %s", person_id)
            return person_id, None

    deadline = time.monotonic() + budget_seconds if budget_seconds is not None else None
    queued, running = deque(to_fetch), set()
    try:
        while queued or running:
            # Past the deadline nothing new starts: it would only run late.
            while queued and len(running) < FETCHES_PER_CALL and (deadline is None or time.monotonic() < deadline):
                running.add(FOLLOWED_POOL.submit(fetch, queued.popleft()))
            remaining = None if deadline is None else max(0.0, deadline - time.monotonic())
            done, running = wait(running, timeout=remaining, return_when=FIRST_COMPLETED)
            if not done:
                logger.warning(
                    "Followed-people credits budget (%ss) ran out with %s of %s fetches unfinished",
                    budget_seconds, len(running) + len(queued), len(to_fetch),
                )
                break
            # On this thread: the production cache is DB-backed.
            arrived = dict(f.result() for f in done)
            stored = _store_credits(store, {pid: c for pid, c in arrived.items() if c is not None}, today)
            cached.update((k, v) for k, v in stored.items() if k in wanted)
    finally:
        # Not started yet: dropped. Already running: kept for the next call.
        for future in running:
            if not future.cancel():
                with _late_lock:
                    _late_pending.add(future)
                future.add_done_callback(_keep_late)

    return [(fp, cached.get(key(fp.person_id), [])) for fp in followed]


class FollowedRecsThrottle(UserRateThrottle):
    """Up to 10 TMDB fetches per call on the server's key; the page asks once
    per load, so this is far above real use."""

    scope = "followed_recs"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([FollowedRecsThrottle])
def followed_people_recommendations(request):
    # One section per person in the UI, so only the most recent follows.
    results = _fetch_followed_people_credits(request.user, limit=10, budget_seconds=FOLLOWED_RECS_BUDGET_SECONDS)
    if not results:
        return Response([])

    watched_set = watched_keys(request.user, results)

    today = timezone.now().date()
    sections = []
    for fp, cast in results:
        dated = []
        # (id, type): a movie and a TV show can share a TMDB id.
        seen = set()
        # New and upcoming work only, newest (upcoming) first. No rating floor:
        # new titles have few votes.
        for c in new_work(cast, today):
            key = (c["id"], c["media_type"])
            if key in watched_set or key in seen:
                continue
            seen.add(key)
            dated.append((credit_date(c), credit_item(c)))
        dated.sort(key=lambda x: x[0], reverse=True)
        items = [item for _, item in dated[:12]]
        if items:
            # Keyed by TMDB id: two followed people can share a name.
            sections.append({"key": f"follow-{fp.person_id}", "label": f"New from {fp.name}", "items": items})

    return Response(sections)
