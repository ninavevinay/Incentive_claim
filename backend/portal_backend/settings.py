from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_bool(name: str, default: bool) -> bool:
    value = str(os.getenv(name, str(default))).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return int(default)


def _parse_database_url(database_url: str) -> dict[str, object]:
    raw = str(database_url or "").strip()
    if not raw:
        raw = f"sqlite:///{(BASE_DIR / 'db.sqlite3')}"

    normalized = raw.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgres+psycopg://",
        "postgresql://",
    )
    parsed = urlparse(normalized)

    if parsed.scheme == "sqlite":
        name = parsed.path.lstrip("/") or str(BASE_DIR / "db.sqlite3")
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": unquote(name),
        }

    if parsed.scheme not in {"postgresql", "postgres"}:
        raise ImproperlyConfigured(f"Unsupported DATABASE_URL scheme: {parsed.scheme}")

    options: dict[str, str] = {}
    statement_timeout = _env_int("DB_STATEMENT_TIMEOUT_MS", 30000)
    if statement_timeout > 0:
        options["options"] = f"-c statement_timeout={statement_timeout}"

    db_config: dict[str, object] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        "CONN_MAX_AGE": _env_int("DB_CONN_MAX_AGE", 0),
    }
    if options:
        db_config["OPTIONS"] = options
    return db_config


SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-change-me")
DEBUG = _env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = ["*"]

DATABASE_URL = os.getenv("DATABASE_URL", "")
DATABASES = {"default": _parse_database_url(DATABASE_URL)}

INSTALLED_APPS = [
    "rest_framework",
    "api.apps.ApiConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "api.middleware.SimpleCORSMiddleware",
    "api.middleware.RateLimitMiddleware",
    "django.middleware.common.CommonMiddleware",
]

SERVICE_NAME = os.getenv("SERVICE_NAME", "gateway").strip().lower() or "gateway"
ROOT_URLCONF = "portal_backend.urls"

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Kolkata")
USE_TZ = False
APPEND_SLASH = False

MEDIA_URL = "/uploads/"
MEDIA_ROOT = BASE_DIR / "uploads"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
STATIC_URL = "/static/"

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 60)

RATE_LIMIT_ENABLED = _env_bool("RATE_LIMIT_ENABLED", True)
RATE_LIMIT_WINDOW_SECONDS = _env_int("RATE_LIMIT_WINDOW_SECONDS", 60)
RATE_LIMIT_MAX_REQUESTS = _env_int("RATE_LIMIT_MAX_REQUESTS", 120)

ALLOWED_EMAIL_DOMAIN = str(os.getenv("ALLOWED_EMAIL_DOMAIN", "sbjit.edu.in")).strip().lower()
ADMIN_EMAIL_ALLOWLIST_RAW = os.getenv("ADMIN_EMAIL_ALLOWLIST", "")
ADMIN_EMAIL_ALLOWLIST = {
    item.strip().lower()
    for item in ADMIN_EMAIL_ALLOWLIST_RAW.split(",")
    if item.strip()
}

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = _env_int("SMTP_PORT", 587)
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "SBJIT NPTEL Reimburse")
SMTP_USE_TLS = _env_bool("SMTP_USE_TLS", True)
SMTP_USE_SSL = _env_bool("SMTP_USE_SSL", False)
SMTP_FROM_ADDRESS = SMTP_FROM_EMAIL or SMTP_USERNAME

OTP_EXPIRE_MINUTES = _env_int("OTP_EXPIRE_MINUTES", 10)
OTP_RESEND_SECONDS = _env_int("OTP_RESEND_SECONDS", 60)
OTP_LENGTH = _env_int("OTP_LENGTH", 6)

DB_POOL_SIZE = _env_int("DB_POOL_SIZE", 20)
DB_MAX_OVERFLOW = _env_int("DB_MAX_OVERFLOW", 40)
DB_POOL_TIMEOUT_SECONDS = _env_int("DB_POOL_TIMEOUT_SECONDS", 30)
DB_POOL_RECYCLE_SECONDS = _env_int("DB_POOL_RECYCLE_SECONDS", 1800)
DB_POOL_USE_LIFO = _env_bool("DB_POOL_USE_LIFO", True)
DB_STATEMENT_TIMEOUT_MS = _env_int("DB_STATEMENT_TIMEOUT_MS", 30000)
APP_QUERY_DEFAULT_LIMIT = _env_int("APP_QUERY_DEFAULT_LIMIT", 100)
APP_QUERY_MAX_LIMIT = _env_int("APP_QUERY_MAX_LIMIT", 500)
RUN_STARTUP_LEGACY_REPAIR = _env_bool("RUN_STARTUP_LEGACY_REPAIR", False)
PORT = _env_int("PORT", 8000)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("api.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PARSER_CLASSES": (
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "EXCEPTION_HANDLER": "api.exceptions.custom_exception_handler",
    "UNAUTHENTICATED_USER": None,
    "UNAUTHENTICATED_TOKEN": None,
}
