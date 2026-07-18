from django.urls import path

from api.views import (
    admin_applications,
    admin_create_authority_user,
    admin_delete_all_non_admin_users,
    admin_delete_application,
    admin_delete_user,
    admin_feedback,
    admin_form_window_endpoint,
    admin_login_events,
    admin_password_resets,
    admin_users,
    create_notice,
    health_view,
    public_notices,
    root_view,
    coordinator_authority_users,
    coordinator_delete_authority_user,
    coordinator_set_authority_user_status,
)


urlpatterns = [
    path("health", health_view),
    path("", root_view),
    path("notices/public", public_notices),
    path("notices/", create_notice),
    path("admin/users", admin_users),
    path("admin/applications", admin_applications),
    path("admin/applications/<int:app_id>", admin_delete_application),
    path("admin/login-events", admin_login_events),
    path("admin/feedback", admin_feedback),
    path("admin/password-resets", admin_password_resets),
    path("admin/form-window", admin_form_window_endpoint),
    path("admin/users/authority", admin_create_authority_user),
    path("admin/coordinator/authority-users", coordinator_authority_users),
    path("admin/coordinator/authority-users/<int:user_id>", coordinator_delete_authority_user),
    path("admin/coordinator/authority-users/<int:user_id>/status", coordinator_set_authority_user_status),
    path("admin/users/non-admin", admin_delete_all_non_admin_users),
    path("admin/users/<int:user_id>", admin_delete_user),
]
