from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis_client

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {e}"

    redis_client = await get_redis_client()
    redis_status = "ok" if redis_client else "unavailable"

    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "database": db_status,
        "redis": redis_status,
    }


@router.get("/")
def root_view():
    return {
        "service": settings.SERVICE_NAME,
        "status": "running",
        "docs": "/docs",
    }
