from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/token/refresh/", TokenRefreshView.as_view()),

    # Watchlist
    path("watchlist/", views.watchlist_list),
    path("watchlist/<int:pk>/", views.watchlist_detail),

    # Watched
    path("watched/", views.watched_list),
    path("watched/<int:pk>/", views.watched_detail),

    # Ratings
    path("ratings/", views.ratings_list),
    path("ratings/<int:pk>/", views.ratings_detail),

    # Lists
    path("lists/", views.lists_list),
    path("lists/<int:pk>/", views.lists_detail),
    path("lists/<int:list_pk>/items/", views.list_items_create),
    path("lists/<int:list_pk>/items/<int:item_pk>/", views.list_items_detail),
]
