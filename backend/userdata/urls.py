from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .recommendations import personalized_recommendations

urlpatterns = [
    # Auth
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
    path("auth/profile/", views.profile),

    # Watchlist
    path("watchlist/", views.watchlist_list),
    path("watchlist/<int:pk>/", views.watchlist_detail),

    # Watched
    path("watched/", views.watched_list),
    path("watched/clear/", views.watched_clear),
    path("watched/bulk/", views.bulk_watched),
    path("watched/<int:pk>/", views.watched_detail),

    # Ratings
    path("ratings/", views.ratings_list),
    path("ratings/<int:pk>/", views.ratings_detail),

    # Lists
    path("lists/", views.lists_list),
    path("lists/<int:pk>/", views.lists_detail),
    path("lists/<int:list_pk>/items/", views.list_items_create),
    path("lists/<int:list_pk>/items/<int:item_pk>/", views.list_items_detail),

    # Personalized recommendations
    path("recommendations/personalized/", personalized_recommendations),
]
