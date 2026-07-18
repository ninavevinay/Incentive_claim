from django.urls import path

from api.views import health_view, public_approved_highlights_view, public_notices, root_view


urlpatterns = [
    path("health", health_view),
    path("", root_view),
    path("applications/public-approved-highlights", public_approved_highlights_view),
    path("notices/public", public_notices),
]
