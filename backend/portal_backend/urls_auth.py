from django.urls import path

from api.views import (
    forgot_password,
    health_view,
    login,
    profile_me_endpoint,
    register,
    register_authority,
    request_otp,
    reset_password,
    root_view,
    verify_otp,
)


urlpatterns = [
    path("health", health_view),
    path("", root_view),
    path("auth/request-otp", request_otp),
    path("auth/verify-otp", verify_otp),
    path("auth/login", login),
    path("auth/register-authority", register_authority),
    path("auth/register", register),
    path("auth/forgot-password", forgot_password),
    path("auth/reset-password", reset_password),
    path("profile/me", profile_me_endpoint),
]
