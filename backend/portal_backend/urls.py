from django.urls import include, path

from api.views import health_view, root_view, serve_media_file


urlpatterns = [
    path("api/", include("api.urls")),
    path("health", health_view),
    path("", root_view),
    path("uploads/<path:path>", serve_media_file),
]
