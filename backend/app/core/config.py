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
