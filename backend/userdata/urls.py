from django.urls import path
from . import (
    auth_views, lists_views, ratings_views, social_views, stats_views, tmdb_views, watched_views, watchlist_views,
)
from rest_framework_simplejwt.views import TokenBlacklistView

from .auth_views import SafeTokenRefreshView, TokenSessionThrottle
from .recommendations import personalized_recommendations, recommendations_for_you
from .tmdb_proxy_views import tmdb_proxy
from .notifications_views import new_release_notifications, mark_notifications_seen
from .health_views import health

urlpatterns = [
    # Health check
    path("health/", health),

    # TMDB proxy (key stays server-side)
    path("tmdb/<path:tmdb_path>", tmdb_proxy),

    # Auth
    path("auth/register/", auth_views.register),
    path("auth/login/", auth_views.login),
    path("auth/token/refresh/", SafeTokenRefreshView.as_view()),
    # Blacklists the posted refresh token. Stock view is safe as-is: a token
    # whose user was deleted is handled (user=None), not a 500.
    path("auth/logout/", TokenBlacklistView.as_view(throttle_classes=(TokenSessionThrottle,))),
    path("auth/profile/", auth_views.profile),
    path("auth/avatar/", auth_views.avatar),
    path("auth/delete-account/", auth_views.delete_account),
    path("auth/password-reset/", auth_views.password_reset_request),
    path("auth/password-reset/confirm/", auth_views.password_reset_confirm),

    # Watchlist
    path("watchlist/", watchlist_views.watchlist_list),
    path("watchlist/clear/", watchlist_views.watchlist_clear),
    path("watchlist/bulk/", watchlist_views.bulk_watchlist),
    path("watchlist/<int:pk>/", watchlist_views.watchlist_detail),

    # Watched
    path("watched/", watched_views.watched_list),
    path("watched/clear/", watched_views.watched_clear),
    path("watched/bulk/", watched_views.bulk_watched),
    path("watched/<int:pk>/", watched_views.watched_detail),

    # Ratings
    path("ratings/", ratings_views.ratings_list),
    path("ratings/bulk/", ratings_views.bulk_ratings),
    path("ratings/<int:pk>/", ratings_views.ratings_detail),

    # Lists
    path("lists/", lists_views.lists_list),
    path("lists/<int:pk>/", lists_views.lists_detail),
    path("lists/<int:list_pk>/items/", lists_views.list_items_create),
    path("lists/<int:list_pk>/items/clear/", lists_views.list_items_clear),
    path("lists/<int:list_pk>/items/bulk/", lists_views.list_items_bulk),
    path("lists/<int:list_pk>/items/<int:item_pk>/", lists_views.list_items_detail),

    # Recommendations
    path("recommendations/personalized/", personalized_recommendations),
    path("recommendations/for-you/", recommendations_for_you),

    # Stats
    path("stats/", stats_views.stats),

    # Episode Progress
    path("episode-progress/", social_views.episode_progress_list),
    path("episode-progress/bulk/", social_views.episode_progress_bulk),
    path("episode-progress/<int:show_id>/", social_views.episode_progress),

    # Followed People
    path("followed-people/", social_views.followed_people_list),
    path("followed-people/bulk/", social_views.followed_people_bulk),
    path("followed-people/<int:person_id>/", social_views.followed_people_detail),
    path("recommendations/followed-people/", social_views.followed_people_recommendations),

    # Notifications
    path("notifications/new-releases/", new_release_notifications),
    path("notifications/mark-seen/", mark_notifications_seen),

    # TMDB OAuth
    path("tmdb-auth/request-token/", tmdb_views.tmdb_request_token),
    path("tmdb-auth/create-session/", tmdb_views.tmdb_create_session),
    path("tmdb-auth/status/", tmdb_views.tmdb_auth_status),
    path("tmdb-auth/disconnect/", tmdb_views.tmdb_disconnect),
]
