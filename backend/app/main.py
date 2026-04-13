from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.database import Base, engine, SessionLocal
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.routers import auth, applications, notifications, profile, health, admin, notices, feedback

Base.metadata.create_all(bind=engine)


def _apply_runtime_schema_updates() -> None:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE applications ALTER COLUMN status TYPE VARCHAR(64)"))
        conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS approved_amount DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS benefit_status VARCHAR(32)"))
        conn.execute(text("UPDATE feedbacks SET benefit_status = 'beneficial' WHERE benefit_status IS NULL"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32)"))
        conn.execute(text("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR auth_provider = ''"))
        conn.execute(text("ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'local'"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS email_otps (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, purpose VARCHAR(32) NOT NULL, otp_hash VARCHAR(128) NOT NULL, password_hash VARCHAR(255) NULL, name VARCHAR(120) NULL, role VARCHAR(64) NULL, department VARCHAR(120) NULL, user_id INT NULL REFERENCES users(id), request_ip VARCHAR(64) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP NULL)"))
        conn.execute(text("ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_email_otps_email ON email_otps (email)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS password_reset_requests (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), email VARCHAR(255) NOT NULL, token VARCHAR(128) NOT NULL UNIQUE, request_ip VARCHAR(64) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, used_at TIMESTAMP NULL)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_password_reset_requests_email ON password_reset_requests (email)"))


_apply_runtime_schema_updates()


def _repair_legacy_application_reviews() -> None:
    with SessionLocal() as db:
        updated = applications.repair_legacy_review_history(db)
        if updated:
            print(f"[startup] repaired legacy application reviews: {updated}")


_repair_legacy_application_reviews()

app = FastAPI(title="Incentive Claim API")
if settings.rate_limit_enabled:
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.rate_limit_max_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(notifications.router)
app.include_router(notices.router)
app.include_router(feedback.router)
app.include_router(profile.router)
app.include_router(health.router)
app.include_router(admin.router)
