"""
Shared fixtures and mock data for the CINE DB Playwright test suite.

All tests use page.route() to mock network calls — no real Django/Express server
is required; only the React dev server on http://localhost:3000 must be running.
"""
import json
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
# ---------------------------------------------------------------------------

MOCK_USER = {
    "id": 1,
    "username": "testuser",
    "email": "t@t.com",
    "first_name": "",
    "last_name": "",
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
    "watched": False,
}

MOCK_WATCHED_ITEM = {
    "id": 1,
    "mediaId": 550,
    "mediaType": "movie",
    "title": "Fight Club",
    "posterPath": None,
    "voteAverage": 8.4,
    "watchedAt": "2024-01-15T10:00:00Z",
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
    "createdAt": "2024-01-01T00:00:00Z",
}

MOCK_STATS = {
    "totalWatched": 42,
    "moviesCount": 30,
    "tvCount": 12,
    "totalRatings": 15,
    "avgUserRating": 7.8,
    "avgTmdbRating": 7.2,
    "ratingDistribution": [{"rating": str(i), "count": max(0, i - 3)} for i in range(1, 11)],
    "monthlyActivity": [{"month": "2024-01", "count": 5}, {"month": "2024-02", "count": 8}],
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
    "recommendations": {"results": []},
    "networks": [],
    "created_by": [],
}

EMPTY_RESPONSE = {"results": [], "total_pages": 1, "total_results": 0, "page": 1}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fulfill_json(route: Route, data, status: int = 200) -> None:
    """Fulfill a Playwright route with JSON data."""
    route.fulfill(
        status=status,
        content_type="application/json",
        body=json.dumps(data),
    )


def seed_auth(page: Page) -> None:
    """Inject JWT tokens and user into localStorage before page load."""
    page.add_init_script(
        f"localStorage.setItem('cinedb_access', 'fake-access');"
        f"localStorage.setItem('cinedb_refresh', 'fake-refresh');"
        f"localStorage.setItem('cinedb_user', JSON.stringify({json.dumps(MOCK_USER)}));"
    )


def mock_base_django_routes(page: Page) -> None:
    """Mount baseline empty-list Django API mocks (override per-test as needed)."""
    page.route("**/api/django/watchlist/", lambda r: fulfill_json(r, []))
    page.route("**/api/django/ratings/", lambda r: fulfill_json(r, []))
    page.route("**/api/django/watched/", lambda r: fulfill_json(r, []))
    page.route("**/api/django/lists/", lambda r: fulfill_json(r, []))


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
    page.route("**/api/django/followed-people/**", lambda r: fulfill_json(r, []))


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
    page.route(f"**/api/django/episode-progress/{show_id}/**", lambda r: fulfill_json(r, None))
    page.route(f"**/api/django/episode-progress/{show_id}", lambda r: fulfill_json(r, None))
    page.route("**/api/django/followed-people/**", lambda r: fulfill_json(r, []))


# ---------------------------------------------------------------------------
# Core fixture: authed_page
# ---------------------------------------------------------------------------

@pytest.fixture
def authed_page(page: Page) -> Page:
    """
    A Page with auth tokens seeded in localStorage and baseline Django API mocks.
    Every test that needs an authenticated user should use this fixture instead of `page`.
    """
    seed_auth(page)
    mock_base_django_routes(page)
    return page
