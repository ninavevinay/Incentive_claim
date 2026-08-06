from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core settings
    SECRET_KEY: str = "portal-insecure-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SERVICE_NAME: str = "gateway"
    PORT: int = 5000
    TIME_ZONE: str = "Asia/Kolkata"

    # Database Connection Pool Tuning for 10,000+ users
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'db.sqlite3')}"
    DB_POOL_SIZE: int = 50
    DB_MAX_OVERFLOW: int = 100
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_POOL_RECYCLE_SECONDS: int = 1800
    DB_STATEMENT_TIMEOUT_MS: int = 30000

    # Redis Cache & Connection Pool Storage
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PREFIX: str = "incentive_claim:"
    REDIS_MAX_CONNECTIONS: int = 500
    CACHE_DEFAULT_TTL: int = 600  # 10 minutes

    # Distributed Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_MAX_REQUESTS: int = 600

    # Domain & Security
    ALLOWED_EMAIL_DOMAIN: str = "sbjit.edu.in"
    ADMIN_EMAIL_ALLOWLIST_RAW: str = ""

    # SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "SBJIT NPTEL Reimburse"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # OTP Settings
    OTP_EXPIRE_MINUTES: int = 10
    OTP_RESEND_SECONDS: int = 60
    OTP_LENGTH: int = 6

    # Limits
    APP_QUERY_DEFAULT_LIMIT: int = 100
    APP_QUERY_MAX_LIMIT: int = 500

    # Uploads
    UPLOAD_DIR: Path = BASE_DIR / "uploads"

    @property
    def admin_allowlist(self) -> set[str]:
        raw = os.getenv("ADMIN_EMAIL_ALLOWLIST", self.ADMIN_EMAIL_ALLOWLIST_RAW)
        return {item.strip().lower() for item in raw.split(",") if item.strip()}

    @property
    def normalized_database_url(self) -> str:
        raw = str(self.DATABASE_URL or "").strip()
        if not raw:
            return f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
        if raw.startswith("postgres://"):
            return raw.replace("postgres://", "postgresql+psycopg://", 1)
        if raw.startswith("postgresql://") and not raw.startswith("postgresql+"):
            return raw.replace("postgresql://", "postgresql+psycopg://", 1)
        return raw

    @property
    def smtp_from_address(self) -> str:
        return self.SMTP_FROM_EMAIL or self.SMTP_USERNAME


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
