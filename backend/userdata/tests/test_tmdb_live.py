"""Live TMDB checks: the fields and parts the app reads, against the real API.

Every other test mocks TMDB, so they only prove the code agrees with fake
answers. These ask TMDB itself, opt-in only:

    RUN_LIVE_TMDB=1 pytest -m live_tmdb

They also need a real TMDB_API_KEY (backend/.env). The flag is required
because the local .env already has a key: plain `pytest` and CI on push stay
off the network.

Shape only here: each field the app reads exists with the type it expects.
Fix items add their query-sanity checks to this file (backlog 35, 36), and any
new feature that reads TMDB adds a shape check.

Frontend requests go through the app's own proxy (/api/tmdb/) with the
frontend's parameters. The values most likely to drift (the detail pages'
`append_to_response` lists, the Anime keyword) are compared with the frontend
source by TestFrontendParamDrift, which needs no network and always runs.
Backend checks call the backend's own TMDB functions.
"""
import logging
import os
import re
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from django.conf import settings
from django.test import Client

from userdata import genre_families, metadata_backfill, social_views, tmdb_client
from userdata.models import WatchedEntry

REPO = Path(__file__).resolve().parents[3]
TMDB_TS = REPO / "src" / "api" / "tmdb.ts"
ANIME_TS = REPO / "src" / "pages" / "AnimePage.tsx"
GENRES_TS = REPO / "src" / "constants" / "genres.ts"
DISCOVER_TS = REPO / "src" / "constants" / "discover.ts"

# ── What the frontend sends (each value cites its source) ────────────────────

# src/api/tmdb.ts fetchMovieDetails / fetchTVDetails (checked by the drift tests)
MOVIE_APPEND = "credits,images,videos,recommendations,reviews,similar,watch/providers,release_dates"
TV_APPEND = "external_ids,similar,recommendations,videos,aggregate_credits,images,reviews,watch/providers"
# src/pages/AnimePage.tsx ANIME_KEYWORD (checked by the drift tests)
ANIME_KEYWORD = 210024
# src/constants/discover.ts sort floors, used by filtersToTMDBParams (checked by the drift tests)
SORT_FLOORS = {
    "RATING_SORT_MIN_VOTES": 300,
    "NEWEST_SORT_MIN_VOTES": 10,
    "OLDEST_SORT_MIN_VOTES": 100,
    "TITLE_SORT_MIN_VOTES": 100,
}
# CalendarPage.tsx: its window and per-type page cap
CALENDAR_WINDOW_DAYS = 7
CALENDAR_MAX_PAGES = 3

# Long-lived TMDB ids. Checks assert presence and type, never content.
MOVIE_ID = 550  # Fight Club
TV_ID = 1396  # Breaking Bad: has season 0 (specials)
ACTOR_ID = 287  # Brad Pitt: acting credits
DIRECTOR_ID = 525  # Christopher Nolan: crew-heavy (backlog 36 adds a crew check)
QUERY = "batman"


# ── Opt-in ────────────────────────────────────────────────────────────────────

def _skip_reason():
    if os.environ.get("RUN_LIVE_TMDB") != "1":
        return "live TMDB checks are opt-in: set RUN_LIVE_TMDB=1"
    if not settings.TMDB_API_KEY:
        return "live TMDB checks need TMDB_API_KEY (backend/.env)"
    return None


live = [
    pytest.mark.live_tmdb,
    pytest.mark.skipif(_skip_reason() is not None, reason=_skip_reason() or ""),
]


@pytest.fixture
def quiet_upstream_logs():
    """pytest prints captured logs on failure with its own formatter, not the
    redacting one, and a failed upstream call logs its URL (api_key included).
    Assertions below report what failed instead."""
    loggers = [logging.getLogger(n) for n in ("userdata", "urllib3")]
    levels = [lg.level for lg in loggers]
    for lg in loggers:
        lg.setLevel(100)
    yield
    for lg, level in zip(loggers, levels, strict=True):
        lg.setLevel(level)


# ── Helpers ───────────────────────────────────────────────────────────────────

NUMBER = (int, float)
REQ, NULLABLE, OPT = "required", "nullable", "optional"


def _redact(text):
    key = settings.TMDB_API_KEY
    return text.replace(key, "***") if key else text


def backend_call(feature, fn, *args, **kwargs):
    """Call a backend TMDB function. A failure is re-raised without the API key
    (requests puts the full URL in its messages) and without the chained
    original, whose traceback would print it."""
    try:
        return fn(*args, **kwargs)
    except requests.RequestException as e:
        raise AssertionError(f"{feature}: TMDB call failed: {_redact(f'{type(e).__name__}: {e}')}") from None


def proxy_get(feature, path, params=None):
    """GET through the app's TMDB proxy, as the browser does. Returns the JSON."""
    response = Client().get(f"/api/tmdb/{path}", params or {})
    assert response.status_code == 200, f"{feature} {path}: proxy answered {response.status_code}"
    return response.json()


def _type_name(types):
    if types is NUMBER:
        return "number"
    return types.__name__ if isinstance(types, type) else "/".join(t.__name__ for t in types)


def _is(value, types):
    if isinstance(value, bool) and types is not bool:
        return False  # bool is an int subclass; a flag is never a number here
    return isinstance(value, types)


def assert_shape(feature, path, obj, schema):
    """schema: field -> (types, REQ | NULLABLE | OPT).
    REQ: present and not null. NULLABLE: present, may be null. OPT: may be
    missing or null. When there's a value, it must have the type."""
    where = f"{feature} {path}"
    assert isinstance(obj, dict), f"{where}: expected an object, got {type(obj).__name__}"
    for field, (types, rule) in schema.items():
        if field not in obj:
            assert rule == OPT, f"{where}: field '{field}' missing"
            continue
        value = obj[field]
        if value is None:
            assert rule != REQ, f"{where}: field '{field}' is null"
            continue
        assert _is(value, types), (
            f"{where}: field '{field}' is {type(value).__name__}, expected {_type_name(types)}"
        )


def assert_items(feature, path, items, schema, limit=20):
    """A non-empty list whose items (up to `limit`) all match `schema`."""
    assert isinstance(items, list), f"{feature} {path}: expected a list, got {type(items).__name__}"
    assert items, f"{feature} {path}: empty list"
    for i, item in enumerate(items[:limit]):
        assert_shape(feature, f"{path}[{i}]", item, schema)


def assert_list(feature, path, value):
    """A list (maybe empty): for parts whose content depends on the title."""
    assert isinstance(value, list), f"{feature} {path}: expected a list, got {type(value).__name__}"


# ── Schemas: the fields the app reads (src/types/tmdb.ts and backend readers) ─

PAGE = {"page": (int, REQ), "results": (list, REQ), "total_pages": (int, REQ), "total_results": (int, REQ)}

MOVIE_SUMMARY = {
    "id": (int, REQ),
    "title": (str, REQ),
    "poster_path": (str, NULLABLE),
    "backdrop_path": (str, NULLABLE),
    "overview": (str, REQ),
    "vote_average": (NUMBER, REQ),
    "vote_count": (int, REQ),
    "release_date": (str, OPT),
    "genre_ids": (list, REQ),
    "original_language": (str, REQ),
    "popularity": (NUMBER, REQ),
}
TV_SUMMARY = {
    **{k: v for k, v in MOVIE_SUMMARY.items() if k not in ("title", "release_date")},
    "name": (str, REQ),
    "first_air_date": (str, OPT),
}
PERSON_SUMMARY = {
    "id": (int, REQ),
    "name": (str, REQ),
    "profile_path": (str, NULLABLE),
    "known_for_department": (str, OPT),
    "popularity": (NUMBER, REQ),
}
GENRE = {"id": (int, REQ), "name": (str, REQ)}
IMAGE = {"file_path": (str, REQ), "width": (int, REQ), "height": (int, REQ), "aspect_ratio": (NUMBER, REQ)}
VIDEO = {"key": (str, REQ), "name": (str, REQ), "site": (str, REQ), "type": (str, REQ), "official": (bool, OPT)}
REVIEW = {"id": (str, REQ), "author": (str, REQ), "content": (str, REQ), "created_at": (str, REQ),
          "author_details": (dict, REQ)}
CAST = {"id": (int, REQ), "name": (str, REQ), "character": (str, OPT), "profile_path": (str, NULLABLE),
        "order": (int, REQ)}
CREW = {"id": (int, REQ), "name": (str, REQ), "job": (str, REQ), "department": (str, REQ),
        "profile_path": (str, NULLABLE)}
AGGREGATE_CAST = {"id": (int, REQ), "name": (str, REQ), "profile_path": (str, NULLABLE),
                  "roles": (list, REQ), "total_episode_count": (int, REQ), "order": (int, REQ)}
SEASON = {"id": (int, REQ), "name": (str, REQ), "season_number": (int, REQ), "episode_count": (int, REQ),
          "poster_path": (str, NULLABLE), "air_date": (str, OPT)}
EPISODE = {"id": (int, REQ), "episode_number": (int, REQ), "name": (str, REQ), "overview": (str, REQ),
           "air_date": (str, OPT), "runtime": (int, OPT), "still_path": (str, OPT), "vote_average": (NUMBER, REQ)}
PERSON = {"id": (int, REQ), "name": (str, REQ), "biography": (str, REQ), "birthday": (str, OPT),
          "deathday": (str, OPT), "place_of_birth": (str, OPT), "profile_path": (str, NULLABLE),
          "known_for_department": (str, REQ), "popularity": (NUMBER, REQ), "imdb_id": (str, OPT),
          "homepage": (str, OPT)}
# movie_credits / tv_credits entries carry no media_type (personCredits.ts mergeCrew)
PERSON_MOVIE_CREDIT = {"id": (int, REQ), "title": (str, REQ), "poster_path": (str, NULLABLE),
                       "release_date": (str, OPT), "vote_average": (NUMBER, REQ)}
PERSON_TV_CREDIT = {"id": (int, REQ), "name": (str, REQ), "poster_path": (str, NULLABLE),
                    "first_air_date": (str, OPT), "vote_average": (NUMBER, REQ)}
# What the backend reads from combined_credits (recommendations, social_views)
COMBINED_CREDIT = {"id": (int, REQ), "media_type": (str, REQ), "poster_path": (str, NULLABLE),
                   "vote_average": (NUMBER, REQ)}
PROVIDER = {"provider_id": (int, REQ), "provider_name": (str, REQ), "logo_path": (str, REQ)}


def assert_paginated(feature, path, data, item_schema):
    assert_shape(feature, path, data, PAGE)
    assert_items(feature, f"{path} results", data["results"], item_schema)


def assert_providers(feature, path, part):
    """`watch/providers`: {results: {region: {link?, flatrate?, rent?, buy?}}}."""
    assert_shape(feature, path, part, {"results": (dict, REQ)})
    for region, offers in part["results"].items():
        assert_shape(feature, f"{path} {region}", offers,
                     {"link": (str, OPT), "flatrate": (list, OPT), "rent": (list, OPT), "buy": (list, OPT)})
        for kind in ("flatrate", "rent", "buy"):
            for i, p in enumerate(offers.get(kind) or []):
                assert_shape(feature, f"{path} {region}.{kind}[{i}]", p, PROVIDER)


def assert_detail_parts(feature, path, data, parts):
    """Shared appended parts of the movie and TV detail responses."""
    for part in parts:
        assert part in data, f"{feature} {path}: appended part '{part}' missing"
    assert_shape(feature, f"{path} videos", data["videos"], {"results": (list, REQ)})
    for i, v in enumerate(data["videos"]["results"][:20]):
        assert_shape(feature, f"{path} videos[{i}]", v, VIDEO)
    assert_shape(feature, f"{path} images", data["images"], {"backdrops": (list, REQ), "posters": (list, REQ)})
    for kind in ("backdrops", "posters"):
        assert_items(feature, f"{path} images.{kind}", data["images"][kind], IMAGE)
    for paged in ("reviews", "similar", "recommendations"):
        assert_shape(feature, f"{path} {paged}", data[paged], PAGE)
    for i, r in enumerate(data["reviews"]["results"][:20]):
        assert_shape(feature, f"{path} reviews[{i}]", r, REVIEW)
    assert_providers(feature, f"{path} watch/providers", data["watch/providers"])


# ── Drift: the copies above match the frontend source (no network) ──────────

class TestFrontendParamDrift:
    """Runs in every test run, CI included: the live checks must ask for what
    the frontend asks for, or they check the wrong thing."""

    def test_detail_append_lists_match_tmdb_ts(self):
        appends = re.findall(r'append_to_response:\s*"([^"]+)"', TMDB_TS.read_text(encoding="utf-8"))
        assert appends == [MOVIE_APPEND, TV_APPEND], (
            "src/api/tmdb.ts append_to_response lists changed; update MOVIE_APPEND/TV_APPEND "
            f"in this file (and the checks of any new part). Found: {appends}"
        )

    def test_sort_floors_match_discover_ts(self):
        found = dict(re.findall(r"export const (\w+_MIN_VOTES) = (\d+);", DISCOVER_TS.read_text(encoding="utf-8")))
        assert {k: int(v) for k, v in found.items()} == SORT_FLOORS, (
            f"src/constants/discover.ts floors changed; update SORT_FLOORS in this file. Found: {found}"
        )

    def test_anime_keyword_matches_anime_page(self):
        found = re.search(r"const ANIME_KEYWORD = (\d+);", ANIME_TS.read_text(encoding="utf-8"))
        assert found, "src/pages/AnimePage.tsx: ANIME_KEYWORD not found; update this test"
        assert int(found.group(1)) == ANIME_KEYWORD, (
            f"AnimePage.tsx ANIME_KEYWORD is {found.group(1)}; update ANIME_KEYWORD in this file"
        )


# ── Frontend paths, through /api/tmdb/ ───────────────────────────────────────

def _calendar_params(media_type, start, end, page=1):
    """CalendarPage.tsx fetchCalendar's discover params."""
    field = "primary_release_date" if media_type == "movie" else "first_air_date"
    return {f"{field}.gte": start, f"{field}.lte": end, "sort_by": "popularity.desc", "page": page}


def _sort_params(media_type, sort_by):
    """filtersToTMDBParams (src/api/tmdb.ts) for a sort with no other filter."""
    tv = media_type == "tv"
    field = "first_air_date" if tv else "primary_release_date"
    params = {"sort_by": sort_by.replace("primary_release_date", field) if tv else sort_by}
    if tv and sort_by == "original_title.asc":
        params["sort_by"] = "original_name.asc"
    if sort_by == "vote_average.desc":
        params["vote_count.gte"] = SORT_FLOORS["RATING_SORT_MIN_VOTES"]
    elif sort_by == "primary_release_date.desc":
        params["vote_count.gte"] = SORT_FLOORS["NEWEST_SORT_MIN_VOTES"]
        params[f"{field}.lte"] = date.today().isoformat()
    elif sort_by == "primary_release_date.asc":
        params["vote_count.gte"] = SORT_FLOORS["OLDEST_SORT_MIN_VOTES"]
    elif sort_by == "original_title.asc":
        params["vote_count.gte"] = SORT_FLOORS["TITLE_SORT_MIN_VOTES"]
    return params


def _genre_ids_ts(name):
    """The genre chip ids in src/constants/genres.ts for `movieGenres`/`tvGenres`."""
    block = re.search(rf"export const {name}[^=]*=\s*\[(.*?)\];", GENRES_TS.read_text(encoding="utf-8"), re.S)
    assert block, f"src/constants/genres.ts: {name} not found; update this test"
    return {int(i) for i in re.findall(r"id:\s*(\d+)", block.group(1))}


@pytest.mark.usefixtures("quiet_upstream_logs")
class TestLiveFrontendShapes:
    pytestmark = live

    def test_browse_categories(self):
        # HomePage.tsx: category endpoints, page 1
        for path, schema in (
            ("movie/popular", MOVIE_SUMMARY), ("movie/top_rated", MOVIE_SUMMARY),
            ("movie/now_playing", MOVIE_SUMMARY), ("movie/upcoming", MOVIE_SUMMARY),
            ("tv/popular", TV_SUMMARY), ("tv/top_rated", TV_SUMMARY),
            ("tv/on_the_air", TV_SUMMARY), ("tv/airing_today", TV_SUMMARY),
        ):
            assert_paginated("Browse", path, proxy_get("Browse", path, {"page": 1}), schema)

    def test_browse_discover_with_filters(self):
        # filtersToTMDBParams (tmdb.ts) + with_genres, as HomePage sends them
        movie = {"page": 1, "sort_by": "popularity.desc", "primary_release_date.gte": "2010-01-01",
                 "vote_average.gte": 6, "with_original_language": "en", "with_runtime.gte": 60,
                 "with_genres": "28"}
        tv = {"page": 1, "sort_by": "popularity.desc", "first_air_date.gte": "2010-01-01",
              "vote_average.gte": 6, "with_original_language": "en", "with_genres": "18"}
        assert_paginated("Browse filters", "discover/movie", proxy_get("Browse filters", "discover/movie", movie),
                         MOVIE_SUMMARY)
        assert_paginated("Browse filters", "discover/tv", proxy_get("Browse filters", "discover/tv", tv), TV_SUMMARY)

    def test_anime_discover(self):
        # AnimePage.tsx categoryParams: popular and top rated, TV and movies
        for path, schema in (("discover/tv", TV_SUMMARY), ("discover/movie", MOVIE_SUMMARY)):
            for extra in ({"sort_by": "popularity.desc"}, {"sort_by": "vote_average.desc", "vote_count.gte": 50}):
                params = {"page": 1, "with_keywords": ANIME_KEYWORD, **extra}
                assert_paginated("Anime", path, proxy_get("Anime", path, params), schema)

    def test_search(self):
        # tmdb.ts searchMovies / searchTV / searchPeople
        params = {"query": QUERY, "page": 1, "include_adult": "false"}
        assert_paginated("Search", "search/movie", proxy_get("Search", "search/movie", params), MOVIE_SUMMARY)
        assert_paginated("Search", "search/tv", proxy_get("Search", "search/tv", params), TV_SUMMARY)
        people = proxy_get("Search", "search/person", params)
        assert_paginated("Search", "search/person", people, PERSON_SUMMARY)
        assert_list("Search", "search/person known_for", people["results"][0].get("known_for", []))

    def test_people_popular(self):
        # PeoplePage.tsx fetchPopularPeople
        data = proxy_get("People", "person/popular", {"page": 1})
        assert_paginated("People", "person/popular", data, PERSON_SUMMARY)

    def test_provider_regions(self):
        # RegionSelect.tsx fetchProviderRegions: the Edit Profile region options
        data = proxy_get("Region", "watch/providers/regions")
        assert isinstance(data, dict), "Region watch/providers/regions: expected an object"
        assert_items("Region", "watch/providers/regions", data.get("results"),
                     {"iso_3166_1": (str, REQ), "english_name": (str, REQ)}, limit=300)
        codes = {r["iso_3166_1"] for r in data["results"]}
        assert "US" in codes, "Region watch/providers/regions: no US entry (the fallback region)"

    def test_calendar_discover(self):
        # CalendarPage.tsx: today to 7 days out, by release / first-air date (shape only)
        today, future = date.today().isoformat(), (date.today() + timedelta(days=7)).isoformat()
        movie, tv = _calendar_params("movie", today, future), _calendar_params("tv", today, future)
        assert_paginated("Calendar", "discover/movie", proxy_get("Calendar", "discover/movie", movie), MOVIE_SUMMARY)
        assert_paginated("Calendar", "discover/tv", proxy_get("Calendar", "discover/tv", tv), TV_SUMMARY)

    def test_hero_banner(self):
        # HeroBanner.tsx: trending by type, or (Anime) discover by popularity
        assert_paginated("Hero", "trending/movie/week", proxy_get("Hero", "trending/movie/week"), MOVIE_SUMMARY)
        assert_paginated("Hero", "trending/tv/week", proxy_get("Hero", "trending/tv/week"), TV_SUMMARY)
        anime = proxy_get("Hero", "discover/tv", {"sort_by": "popularity.desc", "with_keywords": ANIME_KEYWORD})
        assert_paginated("Hero", "discover/tv (anime)", anime, TV_SUMMARY)
        assert any(r.get("backdrop_path") for r in anime["results"]), "Hero discover/tv (anime): no backdrops"

    def test_movie_detail(self):
        path = f"movie/{MOVIE_ID}"
        data = proxy_get("Movie detail", path, {"append_to_response": MOVIE_APPEND})
        assert_shape("Movie detail", path, data, {
            **{k: v for k, v in MOVIE_SUMMARY.items() if k != "genre_ids"},
            "genres": (list, REQ), "runtime": (int, NULLABLE), "status": (str, REQ), "tagline": (str, OPT),
            "budget": (int, REQ), "revenue": (int, REQ), "production_companies": (list, REQ),
            "spoken_languages": (list, REQ), "imdb_id": (str, OPT), "homepage": (str, OPT),
        })
        assert_items("Movie detail", f"{path} genres", data["genres"], GENRE)
        assert_detail_parts("Movie detail", path, data, MOVIE_APPEND.split(","))
        assert_shape("Movie detail", f"{path} credits", data["credits"], {"cast": (list, REQ), "crew": (list, REQ)})
        assert_items("Movie detail", f"{path} credits.cast", data["credits"]["cast"], CAST)
        assert_items("Movie detail", f"{path} credits.crew", data["credits"]["crew"], CREW)
        # MovieDetails.tsx certifications
        assert_shape("Movie detail", f"{path} release_dates", data["release_dates"], {"results": (list, REQ)})
        for i, country in enumerate(data["release_dates"]["results"][:20]):
            assert_shape("Movie detail", f"{path} release_dates[{i}]", country,
                         {"iso_3166_1": (str, REQ), "release_dates": (list, REQ)})
            for j, rd in enumerate(country["release_dates"]):
                assert_shape("Movie detail", f"{path} release_dates[{i}][{j}]", rd,
                             {"certification": (str, REQ), "type": (int, REQ)})

    def test_tv_detail(self):
        path = f"tv/{TV_ID}"
        data = proxy_get("TV detail", path, {"append_to_response": TV_APPEND})
        assert_shape("TV detail", path, data, {
            **{k: v for k, v in TV_SUMMARY.items() if k != "genre_ids"},
            "genres": (list, REQ), "number_of_seasons": (int, REQ), "number_of_episodes": (int, REQ),
            "seasons": (list, REQ), "status": (str, REQ), "tagline": (str, OPT),
            "episode_run_time": (list, REQ), "last_episode_to_air": (dict, OPT), "networks": (list, REQ),
            "production_companies": (list, REQ), "spoken_languages": (list, REQ), "homepage": (str, OPT),
            "created_by": (list, OPT),
        })
        assert_items("TV detail", f"{path} seasons", data["seasons"], SEASON)
        assert_detail_parts("TV detail", path, data, TV_APPEND.split(","))
        assert_shape("TV detail", f"{path} external_ids", data["external_ids"], {"imdb_id": (str, OPT)})
        aggregate = data["aggregate_credits"]
        assert_shape("TV detail", f"{path} aggregate_credits", aggregate, {"cast": (list, REQ), "crew": (list, REQ)})
        assert_items("TV detail", f"{path} aggregate_credits.cast", aggregate["cast"], AGGREGATE_CAST)
        # watchRuntime.ts prefillRuntime: episode length, else the last episode's
        if data.get("last_episode_to_air"):
            assert_shape("TV detail", f"{path} last_episode_to_air", data["last_episode_to_air"],
                         {"runtime": (int, OPT)})

    def test_episode_guide(self):
        # EpisodeGuide.tsx fetchTVSeason: a regular season and the specials
        for season in (1, 0):
            path = f"tv/{TV_ID}/season/{season}"
            data = proxy_get("Episode guide", path)
            assert_shape("Episode guide", path, data, {
                "id": (int, REQ), "name": (str, REQ), "season_number": (int, REQ), "episodes": (list, REQ),
                "poster_path": (str, NULLABLE), "air_date": (str, OPT),
            })
            assert_items("Episode guide", f"{path} episodes", data["episodes"], EPISODE)

    def test_person_page(self):
        # PersonPage.tsx: person, movie and TV credits (cast and crew), images
        for person_id in (ACTOR_ID, DIRECTOR_ID):
            base = f"person/{person_id}"
            assert_shape("Person page", base, proxy_get("Person page", base), PERSON)
            movies = proxy_get("Person page", f"{base}/movie_credits")
            tv = proxy_get("Person page", f"{base}/tv_credits")
            for credits, schema, path in ((movies, PERSON_MOVIE_CREDIT, "movie_credits"),
                                          (tv, PERSON_TV_CREDIT, "tv_credits")):
                assert_shape("Person page", f"{base}/{path}", credits, {"cast": (list, REQ), "crew": (list, REQ)})
                for kind in ("cast", "crew"):
                    for i, c in enumerate(credits[kind][:20]):
                        assert_shape("Person page", f"{base}/{path} {kind}[{i}]", c, schema)
                for i, c in enumerate(credits["crew"][:20]):
                    assert_shape("Person page", f"{base}/{path} crew[{i}]", c, {"job": (str, REQ)})
            images = proxy_get("Person page", f"{base}/images")
            assert_items("Person page", f"{base}/images profiles", images.get("profiles"), IMAGE)
        # Credit tabs: the actor has acting credits, the director crew ones
        assert proxy_get("Person page", f"person/{ACTOR_ID}/movie_credits")["cast"], "actor has no movie cast credits"
        assert proxy_get("Person page", f"person/{DIRECTOR_ID}/movie_credits")["crew"], "director has no crew credits"

    def test_genre_chips_match_tmdb(self):
        # constants/genres.ts chips are hardcoded; a genre TMDB adds or drops
        # shows up here.
        for media_type, name in (("movie", "movieGenres"), ("tv", "tvGenres")):
            path = f"genre/{media_type}/list"
            data = proxy_get("Genre chips", path)
            assert_items("Genre chips", f"{path} genres", data.get("genres"), GENRE)
            live_ids = {g["id"] for g in data["genres"]}
            assert live_ids == _genre_ids_ts(name), (
                f"Genre chips {path}: TMDB has {sorted(live_ids)}, src/constants/genres.ts {name} "
                f"has {sorted(_genre_ids_ts(name))}"
            )


# ── Backend paths, through backend functions ────────────────────────────────

@pytest.mark.usefixtures("quiet_upstream_logs")
class TestLiveBackendShapes:
    pytestmark = live

    def test_recommendation_title_details(self):
        # recommendations._fetch_media_details -> tmdb_client.get_details_with_cast
        for media_id, media_type in ((MOVIE_ID, "movie"), (TV_ID, "tv")):
            feature = f"Recommendations get_details_with_cast({media_type} {media_id})"
            details = backend_call(feature, tmdb_client.get_details_with_cast, media_id, media_type)
            genre_ids = details["genre_ids"]
            assert genre_ids and all(isinstance(g, int) for g in genre_ids), f"{feature}: no genre ids"
            assert details["top_cast"], f"{feature}: no top cast"
            for c in details["top_cast"]:
                assert_shape(feature, "top_cast", c, {"id": (int, REQ), "name": (str, REQ)})

    def test_recommendation_discover_by_family(self):
        # recommendations discover_mixed / _compute_personalized
        for media_type in ("movie", "tv"):
            genres = genre_families.with_genres(media_type, ["action-adventure"])
            feature = f"Recommendations discover({media_type}, {genres})"
            results = backend_call(feature, tmdb_client.discover, media_type, genres)
            schema = MOVIE_SUMMARY if media_type == "movie" else TV_SUMMARY
            assert_items(feature, f"discover/{media_type}", results, schema)

    def test_recommendation_inline_requests(self):
        # recommendations.py _compute_for_you: trending (section 2), similar /
        # recommendations (4), hidden gems (5), actor credits (6)
        trending = backend_call("For You trending", tmdb_client._get, "/trending/all/week")
        assert_items("For You trending", "/trending/all/week",
                     [r for r in trending.get("results", []) if r.get("media_type") in ("movie", "tv")],
                     {"id": (int, REQ), "media_type": (str, REQ), "poster_path": (str, NULLABLE),
                      "vote_average": (NUMBER, REQ)})
        similar = backend_call("For You similar", tmdb_client._get, f"/movie/{MOVIE_ID}/similar")
        assert_items("For You similar", f"/movie/{MOVIE_ID}/similar", similar.get("results"), MOVIE_SUMMARY)
        recs = backend_call("For You recommendations", tmdb_client._get, f"/tv/{TV_ID}/recommendations")
        assert_items("For You recommendations", f"/tv/{TV_ID}/recommendations", recs.get("results"), TV_SUMMARY)
        for media_type, schema in (("movie", MOVIE_SUMMARY), ("tv", TV_SUMMARY)):
            gems = backend_call("Hidden gems", tmdb_client._get, f"/discover/{media_type}", {
                "sort_by": "vote_average.desc", "vote_average.gte": 7.5, "vote_count.gte": 50, "vote_count.lte": 1500,
            })
            assert_items("Hidden gems", f"/discover/{media_type}", gems.get("results"), schema)
        credits = backend_call("Because you like", tmdb_client._get, f"/person/{ACTOR_ID}/combined_credits")
        assert_items("Because you like", f"/person/{ACTOR_ID}/combined_credits cast", credits.get("cast"),
                     COMBINED_CREDIT)

    def test_followed_people_credits(self):
        # social_views._fetch_person_credits: what notifications and "New from" read
        feature = "Follows _fetch_person_credits"
        cast = backend_call(feature, social_views._fetch_person_credits, ACTOR_ID)
        assert_items(feature, f"person/{ACTOR_ID}", cast, {
            **COMBINED_CREDIT, "title": (str, OPT), "name": (str, OPT),
            "release_date": (str, OPT), "first_air_date": (str, OPT),
        })
        assert any(social_views.credit_date(c) for c in cast), f"{feature}: no credit has a usable date"
        for c in cast[:20]:
            assert c.get("title") or c.get("name"), f"{feature}: credit {c.get('id')} has neither title nor name"

    def test_stats_genre_names(self):
        # stats_views._get_cached_genre_names, recommendations' section labels
        for media_type in ("movie", "tv"):
            feature = f"Stats genre names ({media_type})"
            names = backend_call(feature, tmdb_client.get_genre_names, media_type, fallback=False)
            assert names, f"{feature}: empty"
            for gid, name in names.items():
                assert isinstance(gid, int) and isinstance(name, str) and name, f"{feature}: bad entry {gid!r}"
                # A genre without a family is pooled as its own, unmapped one.
                assert gid in genre_families.FAMILY_OF, f"{feature}: genre {gid} ({name}) has no family"

    def test_metadata_backfill(self):
        # metadata_backfill.fetch_entry_metadata, on unsaved rows (no DB)
        for media_id, media_type in ((MOVIE_ID, "movie"), (TV_ID, "tv")):
            feature = f"Metadata backfill ({media_type} {media_id})"
            entry = WatchedEntry(pk=0, media_id=media_id, media_type=media_type)
            result = backend_call(feature, metadata_backfill.fetch_entry_metadata, entry)
            assert result is not None, f"{feature}: fetch failed"
            fields, settled = result
            assert not settled, f"{feature}: settled (TMDB answered 404)"
            assert fields["genre_ids"], f"{feature}: no genres"
            assert fields["original_language"] != metadata_backfill.UNKNOWN_LANGUAGE, f"{feature}: no language"
            assert fields["release_year"] != metadata_backfill.UNKNOWN_YEAR, f"{feature}: no release year"


# ── Query sanity: what the queries return makes sense (fix-browse-results) ───

@pytest.mark.usefixtures("quiet_upstream_logs")
class TestLiveQuerySanity:
    pytestmark = live

    def test_calendar_spans_its_window(self):
        today = date.today()
        start, end = today.isoformat(), (today + timedelta(days=CALENDAR_WINDOW_DAYS)).isoformat()
        days = set()
        for page in range(1, CALENDAR_MAX_PAGES + 1):
            data = proxy_get("Calendar", "discover/movie", _calendar_params("movie", start, end, page))
            days |= {r["release_date"] for r in data["results"] if r.get("release_date")}
            if page >= data["total_pages"]:
                break
        assert len(days) >= 3, f"Calendar discover/movie: releases on only {sorted(days)} of {start}..{end}"

    def test_rating_sort_respects_its_floor(self):
        floor = SORT_FLOORS["RATING_SORT_MIN_VOTES"]
        for media_type, extra in (("movie", {}), ("tv", {}), ("tv", {"with_keywords": ANIME_KEYWORD})):
            path = f"discover/{media_type}"
            data = proxy_get("Rating sort", path, {**_sort_params(media_type, "vote_average.desc"), **extra, "page": 1})
            assert data["results"], f"Rating sort {path} {extra}: no results"
            low = [(r.get("title") or r.get("name"), r["vote_count"])
                   for r in data["results"] if r["vote_count"] < floor]
            assert not low, f"Rating sort {path} {extra}: under {floor} votes: {low}"

    def test_newest_sort_is_never_in_the_future(self):
        today = date.today().isoformat()
        for media_type, field in (("movie", "release_date"), ("tv", "first_air_date")):
            path = f"discover/{media_type}"
            data = proxy_get("Newest sort", path, {**_sort_params(media_type, "primary_release_date.desc"), "page": 1})
            assert data["results"], f"Newest sort {path}: no results"
            future = [(r.get("title") or r.get("name"), r.get(field))
                      for r in data["results"] if (r.get(field) or "") > today]
            assert not future, f"Newest sort {path}: dated after {today}: {future}"

    def test_oldest_and_title_sorts_respect_their_floors(self):
        for sort_by, key in (("primary_release_date.asc", "OLDEST_SORT_MIN_VOTES"),
                             ("original_title.asc", "TITLE_SORT_MIN_VOTES")):
            floor = SORT_FLOORS[key]
            for media_type in ("movie", "tv"):
                path = f"discover/{media_type}"
                data = proxy_get(f"{sort_by} sort", path, {**_sort_params(media_type, sort_by), "page": 1})
                assert data["results"], f"{sort_by} sort {path}: no results"
                low = [r["vote_count"] for r in data["results"] if r["vote_count"] < floor]
                assert not low, f"{sort_by} sort {path}: results under {floor} votes: {low}"

    def test_crew_only_person_credits(self):
        # follow-crew-credits: a director's work reaches notifications and "New from"
        feature = "Follows _fetch_person_credits (crew)"
        raw = backend_call(feature, tmdb_client._get, f"/person/{DIRECTOR_ID}/combined_credits")
        credits = backend_call(feature, social_views._fetch_person_credits, DIRECTOR_ID)
        keys = {(c["id"], c["media_type"]) for c in credits}
        talk = {(c["id"], c.get("media_type")) for c in raw.get("cast", []) + raw.get("crew", [])
                if social_views.is_talk_or_news(c)}
        crew = {(c["id"], c.get("media_type")) for c in raw.get("crew", [])} - talk
        assert crew and crew <= keys, f"{feature}: crew credits missing: {sorted(crew - keys)[:10]}"
        leaked = [c.get("title") or c.get("name") for c in credits if (c["id"], c["media_type"]) in talk]
        assert not leaked, f"{feature}: talk/news appearances kept: {leaked}"
        recent = social_views.new_work(credits, date.today())
        assert recent, f"{feature}: no title in the last {social_views.NEW_WORK_DAYS} days or ahead"
