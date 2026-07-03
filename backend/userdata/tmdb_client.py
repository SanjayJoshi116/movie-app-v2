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


def get_details_with_cast(media_id, media_type):
    """Return {genre_ids, top_cast} for a movie or TV show."""
    if media_type == "movie":
        data = _get(f"/movie/{media_id}", {"append_to_response": "credits"})
        cast = [
            {"id": c["id"], "name": c["name"]}
            for c in (data.get("credits") or {}).get("cast", [])[:3]
        ]
    else:
        data = _get(f"/tv/{media_id}", {"append_to_response": "aggregate_credits"})
        cast = [
            {"id": c["id"], "name": c["name"]}
            for c in (data.get("aggregate_credits") or {}).get("cast", [])[:3]
        ]
    return {
        "genre_ids": [g["id"] for g in data.get("genres", [])],
        "top_cast": cast,
    }


def get_genre_names(media_type):
    """Return {genre_id: name} map for movie or tv."""
    data = _get(f"/genre/{media_type}/list")
    return {g["id"]: g["name"] for g in data.get("genres", [])}


def _post(path, body=None, params=None):
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    r = requests.post(f"{TMDB_BASE}{path}", params=p, json=body or {}, timeout=10)
    r.raise_for_status()
    return r.json()


def _delete(path, params=None):
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    r = requests.delete(f"{TMDB_BASE}{path}", params=p, timeout=10)
    r.raise_for_status()
    return r.json()


def get_request_token():
    """Request a new TMDB authentication token."""
    return _get("/authentication/token/new")


def create_session(request_token):
    """Exchange an approved request token for a session_id."""
    return _post("/authentication/session/new", {"request_token": request_token})


def post_rating(media_type, media_id, session_id, value):
    """Post a rating (0.5-10) to TMDB for a movie or TV show."""
    return _post(
        f"/{media_type}/{media_id}/rating",
        {"value": value},
        {"session_id": session_id},
    )


def delete_rating(media_type, media_id, session_id):
    """Delete a rating from TMDB for a movie or TV show."""
    return _delete(
        f"/{media_type}/{media_id}/rating",
        {"session_id": session_id},
    )
