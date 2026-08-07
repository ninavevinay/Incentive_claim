from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
from app.core.redis import close_redis, get_redis_client
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import (
    admin,
    applications,
    auth,
    feedback,
    health,
    notices,
    notifications,
    profile,
)

logger = logging.getLogger("api.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Database tables if not exist...")
    Base.metadata.create_all(bind=engine)
    logger.info("Initializing Redis connection...")
    await get_redis_client()
    yield
    # Shutdown
    logger.info("Closing Redis connection...")
    await close_redis()


app = FastAPI(
    title="SBJIT NPTEL Incentive Portal API",
    description="Scalable FastAPI Backend with Redis Caching, Rate Limiting & JWT Management",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting
app.add_middleware(RateLimitMiddleware)

# Static files for Uploads

settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")

# Include Routers under /api
api_prefix = "/api"
app.include_router(health.router)
app.include_router(auth.router, prefix=api_prefix)
app.include_router(profile.router, prefix=api_prefix)
app.include_router(applications.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)
app.include_router(feedback.router, prefix=api_prefix)
app.include_router(notices.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)

# Include Routers at root level as fallback for direct routes
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(applications.router)
app.include_router(notifications.router)
app.include_router(feedback.router)
app.include_router(notices.router)
app.include_router(admin.router)


from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler

import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)
    tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    print(f"--- UNHANDLED EXCEPTION on {request.url.path} ---\n{tb_str}")
    logger.error(f"Unhandled exception on {request.url.path}: {exc}\n{tb_str}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc) or "An internal server error occurred."},
    )


