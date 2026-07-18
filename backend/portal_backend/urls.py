from django.conf import settings
from django.urls import include, path

from api.views import health_view, root_view, serve_media_file


def _api_include_target() -> str:
    service_name = getattr(settings, "SERVICE_NAME", "gateway").strip().lower() or "gateway"
    if service_name == "auth":
        return "portal_backend.urls_auth"
    if service_name == "applications":
        return "portal_backend.urls_applications"
    if service_name == "admin":
        return "portal_backend.urls_admin"
    if service_name == "notifications":
        return "portal_backend.urls_notifications"
    if service_name == "public":
        return "portal_backend.urls_public"
    return "api.urls"


urlpatterns = [
    path("api/", include(_api_include_target())),
    path("health", health_view),
    path("", root_view),
    path("uploads/<path:path>", serve_media_file),
]
