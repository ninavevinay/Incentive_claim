from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

from api.views import health_view, root_view


urlpatterns = [
    path("api/", include("api.urls")),
    path("health", health_view),
    path("", root_view),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

