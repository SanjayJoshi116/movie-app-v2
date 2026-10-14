from django.conf import settings
from django.urls import path, include, re_path
from django.views.static import serve

urlpatterns = [
    path("api/", include("userdata.urls")),
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
