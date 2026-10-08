from django.urls import path
from . import views
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
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/token/refresh/", SafeTokenRefreshView.as_view()),
    # Blacklists the posted refresh token. Stock view is safe as-is: a token
    # whose user was deleted is handled (user=None), not a 500.
    path("auth/logout/", TokenBlacklistView.as_view(throttle_classes=(TokenSessionThrottle,))),
    path("auth/profile/", views.profile),
    path("auth/avatar/", views.avatar),
    path("auth/delete-account/", views.delete_account),
    path("auth/password-reset/", views.password_reset_request),
    path("auth/password-reset/confirm/", views.password_reset_confirm),

    # Watchlist
    path("watchlist/", views.watchlist_list),
    path("watchlist/clear/", views.watchlist_clear),
    path("watchlist/bulk/", views.bulk_watchlist),
    path("watchlist/<int:pk>/", views.watchlist_detail),

    # Watched
    path("watched/", views.watched_list),
    path("watched/clear/", views.watched_clear),
    path("watched/bulk/", views.bulk_watched),
    path("watched/<int:pk>/", views.watched_detail),

    # Ratings
    path("ratings/", views.ratings_list),
    path("ratings/bulk/", views.bulk_ratings),
    path("ratings/<int:pk>/", views.ratings_detail),

    # Lists
    path("lists/", views.lists_list),
    path("lists/<int:pk>/", views.lists_detail),
    path("lists/<int:list_pk>/items/", views.list_items_create),
    path("lists/<int:list_pk>/items/clear/", views.list_items_clear),
    path("lists/<int:list_pk>/items/<int:item_pk>/", views.list_items_detail),

    # Recommendations
    path("recommendations/personalized/", personalized_recommendations),
    path("recommendations/for-you/", recommendations_for_you),

    # Stats
    path("stats/", views.stats),

    # Episode Progress
    path("episode-progress/<int:show_id>/", views.episode_progress),

    # Followed People
    path("followed-people/", views.followed_people_list),
    path("followed-people/<int:person_id>/", views.followed_people_detail),
    path("recommendations/followed-people/", views.followed_people_recommendations),

    # Notifications
    path("notifications/new-releases/", new_release_notifications),
    path("notifications/mark-seen/", mark_notifications_seen),

    # TMDB OAuth
    path("tmdb-auth/request-token/", views.tmdb_request_token),
    path("tmdb-auth/create-session/", views.tmdb_create_session),
    path("tmdb-auth/status/", views.tmdb_auth_status),
    path("tmdb-auth/disconnect/", views.tmdb_disconnect),
]
