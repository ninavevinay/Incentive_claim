from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.database import Base, engine, SessionLocal
from app.routers import auth, applications, notifications, profile, health, admin

Base.metadata.create_all(bind=engine)


def _apply_runtime_schema_updates() -> None:
    # Existing databases may still have status VARCHAR(30).
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE applications ALTER COLUMN status TYPE VARCHAR(64)"))


_apply_runtime_schema_updates()


def _repair_legacy_application_reviews() -> None:
    with SessionLocal() as db:
        updated = applications.repair_legacy_review_history(db)
        if updated:
            print(f"[startup] repaired legacy application reviews: {updated}")


_repair_legacy_application_reviews()

app = FastAPI(title="Incentive Claim API")

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
app.include_router(profile.router)
app.include_router(health.router)
app.include_router(admin.router)
