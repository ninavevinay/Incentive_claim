from django.urls import path

from api.views import health_view, list_notifications, mark_notification_read, root_view


urlpatterns = [
    path("health", health_view),
    path("", root_view),
    path("notifications/", list_notifications),
    path("notifications/<int:notification_id>/read", mark_notification_read),
]
