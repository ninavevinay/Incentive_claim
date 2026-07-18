from django.urls import path

from api.views import (
    all_applications,
    feedback_report,
    health_view,
    list_notifications,
    mark_notification_read,
    my_applications,
    my_feedback,
    my_reviewed_applications,
    pending_applications,
    public_approved_highlights_view,
    review_application,
    role_reviewed_applications,
    root_view,
    submit_faculty,
    submit_feedback,
    submit_student,
    track,
)


urlpatterns = [
    path("health", health_view),
    path("", root_view),
    path("applications/student", submit_student),
    path("applications/faculty", submit_faculty),
    path("applications/public-approved-highlights", public_approved_highlights_view),
    path("applications/mine", my_applications),
    path("applications/track/<int:application_id>", track),
    path("applications/pending", pending_applications),
    path("applications/all", all_applications),
    path("applications/my-reviewed", my_reviewed_applications),
    path("applications/role-reviewed", role_reviewed_applications),
    path("applications/<int:application_id>/review", review_application),
    path("notifications/", list_notifications),
    path("notifications/<int:notification_id>/read", mark_notification_read),
    path("feedback/", submit_feedback),
    path("feedback/mine", my_feedback),
    path("feedback/report", feedback_report),
]
