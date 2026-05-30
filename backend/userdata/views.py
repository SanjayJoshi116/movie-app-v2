# views.py — re-exports from domain modules for backward compatibility.
# Import directly from domain modules for new code.
from .auth_views import (
    password_reset_request,
    password_reset_confirm,
    register,
    login,
    profile,
    delete_account,
)
from .watchlist_views import watchlist_list, watchlist_detail, watchlist_clear
from .watched_views import watched_list, watched_detail, watched_clear, bulk_watched
from .ratings_views import ratings_list, ratings_detail
from .lists_views import lists_list, lists_detail, list_items_create, list_items_detail, list_items_clear
from .tmdb_views import tmdb_request_token, tmdb_create_session, tmdb_auth_status, tmdb_disconnect
from .stats_views import stats
from .social_views import episode_progress, followed_people_list, followed_people_detail, followed_people_recommendations

__all__ = [
    "password_reset_request", "password_reset_confirm", "register", "login", "profile", "delete_account",
    "watchlist_list", "watchlist_detail", "watchlist_clear",
    "watched_list", "watched_detail", "watched_clear", "bulk_watched",
    "ratings_list", "ratings_detail",
    "lists_list", "lists_detail", "list_items_create", "list_items_detail", "list_items_clear",
    "tmdb_request_token", "tmdb_create_session", "tmdb_auth_status", "tmdb_disconnect",
    "stats",
    "episode_progress", "followed_people_list", "followed_people_detail", "followed_people_recommendations",
]
