from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = 60
    rate_limit_max_requests: int = 120
    allowed_email_domain: str = Field(default="sbjit.edu.in", alias="ALLOWED_EMAIL_DOMAIN")
    admin_email_allowlist_raw: str = Field(default="", alias="ADMIN_EMAIL_ALLOWLIST")
    smtp_host: str = Field(default="smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="", alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="", alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(default="SBJIT Incentive Portal", alias="SMTP_FROM_NAME")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")
    otp_expire_minutes: int = Field(default=10, alias="OTP_EXPIRE_MINUTES")
    otp_resend_seconds: int = Field(default=60, alias="OTP_RESEND_SECONDS")
    otp_length: int = Field(default=6, alias="OTP_LENGTH")
    db_pool_size: int = Field(default=20, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=40, alias="DB_MAX_OVERFLOW")
    db_pool_timeout_seconds: int = Field(default=30, alias="DB_POOL_TIMEOUT_SECONDS")
    db_pool_recycle_seconds: int = Field(default=1800, alias="DB_POOL_RECYCLE_SECONDS")
    db_pool_use_lifo: bool = Field(default=True, alias="DB_POOL_USE_LIFO")
    db_statement_timeout_ms: int = Field(default=30000, alias="DB_STATEMENT_TIMEOUT_MS")
    app_query_default_limit: int = Field(default=100, alias="APP_QUERY_DEFAULT_LIMIT")
    app_query_max_limit: int = Field(default=500, alias="APP_QUERY_MAX_LIMIT")
    run_startup_legacy_repair: bool = Field(default=True, alias="RUN_STARTUP_LEGACY_REPAIR")

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8-sig",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        return (
            value.replace("postgresql+psycopg://", "postgresql://")
            .replace("postgres+psycopg://", "postgres://")
            if isinstance(value, str)
            else value
        )

    @field_validator("allowed_email_domain", mode="before")
    @classmethod
    def normalize_allowed_email_domain(cls, value: str) -> str:
        return str(value or "sbjit.edu.in").strip().lower()

    @field_validator("otp_expire_minutes", "otp_resend_seconds", "otp_length")
    @classmethod
    def ensure_positive_numbers(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("OTP settings must be positive")
        return value

    @field_validator(
        "db_pool_size",
        "db_pool_timeout_seconds",
        "db_pool_recycle_seconds",
        "app_query_default_limit",
        "app_query_max_limit",
    )
    @classmethod
    def ensure_positive_scaling_values(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Scaling settings must be positive")
        return value

    @field_validator("db_max_overflow", "db_statement_timeout_ms")
    @classmethod
    def ensure_non_negative_scaling_values(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Scaling settings cannot be negative")
        return value

    @property
    def admin_email_allowlist(self) -> set[str]:
        return {
            item.strip().lower()
            for item in self.admin_email_allowlist_raw.split(",")
            if item.strip()
        }

    @property
    def smtp_from_address(self) -> str:
        return self.smtp_from_email or self.smtp_username


settings = Settings()
