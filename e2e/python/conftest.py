"""
Shared fixtures and mock data for the CINE DB Playwright test suite.

All tests use page.route() to mock network calls — no real Django server
is required; only the React dev server on http://localhost:3000 must be running.
"""
import json
import re
import pytest
from playwright.sync_api import Page, Route

# ---------------------------------------------------------------------------
# Base URL
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def base_url():
    return "http://localhost:3000"


# ---------------------------------------------------------------------------
# Mock data constants
#
# Keep every MOCK_* record a plain dict literal with the API's own field names:
# backend/userdata/tests/test_e2e_mock_shapes.py reads them with ast and fails
# when their keys drift from the serializers / stats response.
# ---------------------------------------------------------------------------

MOCK_USER = {
    "id": 1,
    "username": "testuser",
    "email": "t@t.com",
    "first_name": "",
    "last_name": "",
    "is_staff": False,
    "avatar_url": None,
}

MOCK_TOKENS = {"access": "fake-access", "refresh": "fake-refresh"}

MOCK_MOVIE = {
    "id": 550,
    "title": "Fight Club",
    "overview": "An insomniac office worker forms an underground fight club.",
    "poster_path": "/poster.jpg",
    "backdrop_path": None,
    "release_date": "1999-10-15",
    "vote_average": 8.4,
    "vote_count": 1000,
    "genre_ids": [18],
    "popularity": 80,
    "adult": False,
    "original_language": "en",
    "original_title": "Fight Club",
    "video": False,
}

MOCK_MOVIES = [
    {
        "id": 100 + i,
        "title": f"Movie {i + 1}",
        "overview": "Test overview",
        "poster_path": None,
        "backdrop_path": None,
        "release_date": "2024-01-01",
        "vote_average": 7.0 + i * 0.1,
        "vote_count": 500,
        "genre_ids": [28],
        "popularity": 100,
        "adult": False,
        "original_language": "en",
        "original_title": f"Movie {i + 1}",
        "video": False,
    }
    for i in range(6)
]

MOCK_MOVIE_RESPONSE = {"results": MOCK_MOVIES, "total_pages": 3, "total_results": 60, "page": 1}

MOCK_TV_SHOWS = [
    {
        "id": 200 + i,
        "name": f"Show {i + 1}",
        "overview": "Test TV overview",
        "poster_path": None,
        "backdrop_path": None,
        "first_air_date": "2024-01-01",
        "vote_average": 7.5 + i * 0.1,
        "vote_count": 400,
        "genre_ids": [18, 80],
        "popularity": 90,
        "adult": False,
        "original_language": "en",
        "original_name": f"Show {i + 1}",
    }
    for i in range(6)
]

MOCK_TV_RESPONSE = {"results": MOCK_TV_SHOWS, "total_pages": 2, "total_results": 20, "page": 1}

MOCK_WATCHLIST_ITEM = {
    "id": 1,
    "mediaId": 550,
    "mediaType": "movie",
    "title": "Fight Club",
    "posterPath": None,
    "voteAverage": 8.4,
    "addedAt": "2024-01-15T10:00:00Z",
}

MOCK_WATCHED_ITEM = {
    "id": 1,
    "mediaId": 550,
    "mediaType": "movie",
    "title": "Fight Club",
    "posterPath": None,
    "voteAverage": 8.4,
    "watchedAt": "2024-01-15T10:00:00Z",
    "watchedTz": "",
    "originalLanguage": "en",
    "releaseYear": 1999,
    "runtimeMinutes": 139,
    "platform": None,
}

MOCK_LIST = {
    "id": 1,
    "name": "Favorites",
    "description": "My favorite movies",
    "items": [],
    "createdAt": "2024-01-01T00:00:00Z",
}

MOCK_RATING = {
    "id": 1,
    "mediaId": 550,
    "mediaType": "movie",
    "title": "Fight Club",
    "userRating": 9,
    "review": "Masterpiece.",
    "ratedAt": "2024-01-01T00:00:00Z",
}

MOCK_STATS = {
    "totalWatched": 42,
    "moviesCount": 30,
    "tvCount": 12,
    "totalRatings": 15,
    "avgUserRating": 7.8,
    "avgTmdbRating": 7.2,
    "ratingDistribution": [
        {"rating": "1", "count": 0},
        {"rating": "2", "count": 0},
        {"rating": "3", "count": 0},
        {"rating": "4", "count": 1},
        {"rating": "5", "count": 2},
        {"rating": "6", "count": 3},
        {"rating": "7", "count": 4},
        {"rating": "8", "count": 5},
        {"rating": "9", "count": 6},
        {"rating": "10", "count": 7},
    ],
    "monthlyActivity": [{"month": "Jan 2024", "count": 5}, {"month": "Feb 2024", "count": 8}],
    "topGenres": [{"genre": "Action", "count": 10}, {"genre": "Drama", "count": 8}],
    "languageBreakdown": [{"language": "en", "count": 35}, {"language": "ko", "count": 7}],
    "decadeBreakdown": [{"decade": "2010s", "count": 20}, {"decade": "2000s", "count": 15}],
    "dailyActivity": [{"date": "2024-01-15", "count": 2}, {"date": "2024-01-16", "count": 1}],
    "topRatedItems": [
        {"title": "Fight Club", "posterPath": None, "userRating": 9, "mediaType": "movie"}
    ],
    "recentItems": [
        {"title": "Fight Club", "posterPath": None, "watchedAt": "2024-01-15", "mediaType": "movie"}
    ],
    "totalRuntimeMinutes": 5040,
    "platformBreakdown": [{"platform": "Netflix", "count": 12}],
    "ratingByGenre": [{"genre": "Drama", "avgRating": 8.1}],
    "reviewsWritten": 4,
    "listsCount": 2,
    "listsItemsCount": 9,
    "watchlistTotal": 6,
    "watchlistUnwatched": 3,
}

MOCK_MOVIE_DETAIL = {
    "id": 100,
    "title": "Movie 1",
    "overview": "Test movie overview",
    "release_date": "2024-01-01",
    "poster_path": None,
    "backdrop_path": None,
    "genres": [{"id": 28, "name": "Action"}],
    "runtime": 120,
    "vote_average": 7.5,
    "vote_count": 200,
    "status": "Released",
    "original_language": "en",
    "budget": 0,
    "revenue": 0,
    "credits": {"cast": [], "crew": []},
    "images": {"backdrops": []},
    "videos": {"results": []},
    "recommendations": {"results": []},
    "certifications": [],
}

MOCK_TV_DETAIL = {
    "id": 1396,
    "name": "Breaking Bad",
    "overview": "A high school chemistry teacher turned drug lord.",
    "first_air_date": "2008-01-20",
    "poster_path": None,
    "backdrop_path": None,
    "genres": [{"id": 18, "name": "Drama"}, {"id": 80, "name": "Crime"}],
    "vote_average": 9.5,
    "vote_count": 12000,
    "status": "Ended",
    "original_language": "en",
    "number_of_seasons": 5,
    "number_of_episodes": 62,
    "seasons": [
        {
            "id": 3572,
            "season_number": 1,
            "episode_count": 7,
            "name": "Season 1",
            "air_date": "2008-01-20",
            "poster_path": None,
        }
    ],
    "credits": {"cast": [], "crew": []},
    "images": {"backdrops": []},
    "videos": {"results": []},
    "recommendations": {"results": []},
    "networks": [],
    "created_by": [],
}

EMPTY_RESPONSE = {"results": [], "total_pages": 1, "total_results": 0, "page": 1}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Collection URLs of the paginated list endpoints (not detail/bulk/clear routes).
PAGINATED_LIST_URL = re.compile(r"/api/(watchlist|watched|ratings|lists|followed-people)/(\?|$)")

# Bare-list bodies sent to a paginated endpoint; the autouse fixture below
# fails the test at teardown. Raising inside a route handler wouldn't reach
# the test reliably (it runs on Playwright's dispatch thread).
_bare_list_mocks: list = []


@pytest.fixture(autouse=True)
def _reject_bare_list_mocks():
    _bare_list_mocks.clear()
    yield
    assert not _bare_list_mocks, (
        "List endpoints mocked with a bare list (wrap them in paginated()):\n  "
        + "\n  ".join(_bare_list_mocks)
    )


def fulfill_json(route: Route, data, status: int = 200) -> None:
    """Fulfill a Playwright route with JSON data."""
    if isinstance(data, list) and PAGINATED_LIST_URL.search(route.request.url):
        _bare_list_mocks.append(route.request.url)
    route.fulfill(
        status=status,
        content_type="application/json",
        body=json.dumps(data),
    )


def paginated(items) -> dict:
    """The real list-endpoint response shape (DRF pagination), not a bare list.

    fetchAllPages() also accepts a bare array, so `[]` mocks used to pass on a
    shape production never sends.
    """
    return {"count": len(items), "next": None, "previous": None, "results": list(items)}


def seed_auth(page: Page) -> None:
    """Inject JWT tokens and user into localStorage before page load."""
    page.add_init_script(
        f"localStorage.setItem('cinedb_access', 'fake-access');"
        f"localStorage.setItem('cinedb_refresh', 'fake-refresh');"
        f"localStorage.setItem('cinedb_user', JSON.stringify({json.dumps(MOCK_USER)}));"
    )


def mock_base_django_routes(page: Page) -> None:
    """Mount baseline empty-list Django API mocks (override per-test as needed).

    Trailing `**` matters here: fetchAllPages() (src/utils/fetchAllPages.ts) always
    appends `?page=1` even on the first request, so an exact-match pattern with no
    wildcard misses it, falls through to the autouse 401 block, and the app's
    401-refresh interceptor (also unmocked -> also 401) hard-redirects to /login in
    a loop. `lists/` isn't paginated so it never had this problem, but the wildcard
    is harmless there too.
    """
    for path in ("watchlist", "ratings", "watched", "lists", "followed-people"):
        page.route(f"**/api/{path}/**", lambda r: fulfill_json(r, paginated([])))
    # NotificationBell polls this on every authenticated page (Sidebar/BottomNav
    # render it globally); the bell marks items seen when it closes.
    page.route("**/api/notifications/new-releases/**", lambda r: fulfill_json(r, {"items": [], "unreadCount": 0}))
    page.route("**/api/notifications/mark-seen/**", lambda r: r.fulfill(status=204, body=""))


def mock_tmdb_movies(page: Page, response=None) -> None:
    """Mount TMDB movie/discover routes with mock movie data."""
    resp = response or MOCK_MOVIE_RESPONSE
    page.route("**/api/tmdb/discover/movie**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/trending/**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/movie/now_playing**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/movie/top_rated**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/movie/upcoming**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/movie/popular**", lambda r: fulfill_json(r, resp))


def mock_tmdb_tv(page: Page, response=None) -> None:
    """Mount TMDB TV/discover routes with mock TV data."""
    resp = response or MOCK_TV_RESPONSE
    page.route("**/api/tmdb/discover/tv**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/tv/popular**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/tv/top_rated**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/tv/on_the_air**", lambda r: fulfill_json(r, resp))
    page.route("**/api/tmdb/tv/airing_today**", lambda r: fulfill_json(r, resp))


def mock_movie_detail_routes(page: Page, movie_id: int = 100, detail=None) -> None:
    """Mount all routes needed by the movie detail page."""
    det = detail or MOCK_MOVIE_DETAIL
    page.route(f"**/api/tmdb/movie/{movie_id}**", lambda r: fulfill_json(r, det))
    page.route(f"**/api/tmdb/movie/{movie_id}/reviews**", lambda r: fulfill_json(r, {"results": [], "total_pages": 1}))
    page.route(f"**/api/tmdb/movie/{movie_id}/similar**", lambda r: fulfill_json(r, EMPTY_RESPONSE))
    page.route(f"**/api/tmdb/movie/{movie_id}/watch*", lambda r: fulfill_json(r, {"results": {}}))
    page.route(f"**/api/tmdb/movie/{movie_id}/release_dates**", lambda r: fulfill_json(r, {"results": []}))
    page.route("**/api/tmdb/person/**", lambda r: fulfill_json(r, {"id": 1, "name": "Actor", "profile_path": None}))
    page.route("**/api/followed-people/**", lambda r: fulfill_json(r, paginated([])))


def mock_tv_detail_routes(page: Page, show_id: int = 1396, detail=None) -> None:
    """Mount all routes needed by the TV detail page."""
    det = detail or MOCK_TV_DETAIL
    page.route(f"**/api/tmdb/tv/{show_id}**", lambda r: fulfill_json(r, det))
    page.route(f"**/api/tmdb/tv/{show_id}/season/**", lambda r: fulfill_json(r, {
        "id": 3572, "name": "Season 1", "season_number": 1,
        "episodes": [
            {"id": 1, "name": "Pilot", "episode_number": 1, "still_path": None,
             "overview": "Pilot episode", "vote_average": 9.0, "air_date": "2008-01-20"}
        ],
    }))
    page.route(f"**/api/tmdb/tv/{show_id}/aggregate_credits**", lambda r: fulfill_json(r, {"cast": [], "crew": []}))
    page.route(f"**/api/tmdb/tv/{show_id}/watch*", lambda r: fulfill_json(r, {"results": {}}))
    page.route(f"**/api/episode-progress/{show_id}/**", lambda r: fulfill_json(r, None))
    page.route(f"**/api/episode-progress/{show_id}", lambda r: fulfill_json(r, None))
    page.route("**/api/followed-people/**", lambda r: fulfill_json(r, paginated([])))


# ---------------------------------------------------------------------------
# Core fixture: authed_page
# ---------------------------------------------------------------------------

def install_unmocked_catch_all(page: Page) -> list:
    """Register a catch-all for `/api/**` and return the list it records into.

    Must be registered before any other route: Playwright checks routes
    last-registered-first, so every specific mock overrides it. An app API
    call nothing else handles gets a 501 and is recorded, so the test fails
    naming it. Unmocked TMDB proxy calls (decorative hero/provider fetches)
    get an empty page instead.
    """
    unmocked = []

    def handle(route: Route) -> None:
        url = route.request.url
        if "/api/tmdb/" in url:
            fulfill_json(route, EMPTY_RESPONSE)
            return
        unmocked.append(f"{route.request.method} {url}")
        fulfill_json(route, {"detail": f"unmocked: {url}"}, status=501)

    page.route("**/api/**", handle)
    return unmocked


@pytest.fixture
def authed_page(page: Page):
    """
    A Page with auth tokens seeded in localStorage and baseline Django API mocks.
    Every test that needs an authenticated user should use this fixture instead of `page`.
    Fails the test at teardown if the app made an API call no mock handled.
    """
    unmocked = install_unmocked_catch_all(page)
    seed_auth(page)
    mock_base_django_routes(page)
    yield page
    assert not unmocked, "Unmocked app API calls (add a page.route for each):\n  " + "\n  ".join(unmocked)
