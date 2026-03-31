import requests
from django.conf import settings

TMDB_BASE = "https://api.themoviedb.org/3"


def _get(path, params=None):
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    r = requests.get(f"{TMDB_BASE}{path}", params=p, timeout=10)
    r.raise_for_status()
    return r.json()


def get_genre_ids(media_id, media_type):
    """Return genre ID list for a movie or TV show."""
    data = _get(f"/{media_type}/{media_id}")
    return [g["id"] for g in data.get("genres", [])]


def discover(media_type, genre_ids, page=1):
    """Discover movies or TV by genre IDs. Returns raw result list."""
    params = {
        "with_genres": ",".join(str(g) for g in genre_ids),
        "sort_by": "vote_average.desc",
        "vote_count.gte": 100 if media_type == "movie" else 50,
        "page": page,
    }
    data = _get(f"/discover/{media_type}", params)
    return data.get("results", [])


def get_genre_names(media_type):
    """Return {genre_id: name} map for movie or tv."""
    data = _get(f"/genre/{media_type}/list")
    return {g["id"]: g["name"] for g in data.get("genres", [])}
