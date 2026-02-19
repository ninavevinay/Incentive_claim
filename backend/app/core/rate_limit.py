from __future__ import annotations

from collections import deque
from threading import Lock
from time import monotonic
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        max_requests: int = 120,
        window_seconds: int = 60,
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()
        self._last_cleanup = monotonic()

    def _client_ip(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
            if ip:
                return ip
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if path.startswith(("/health", "/docs", "/redoc", "/openapi.json", "/uploads/")):
            return await call_next(request)

        now = monotonic()
        ip = self._client_ip(request)

        with self._lock:
            hit_times = self._hits.setdefault(ip, deque())
            while hit_times and now - hit_times[0] > self.window_seconds:
                hit_times.popleft()

            if len(hit_times) >= self.max_requests:
                retry_after = max(1, int(self.window_seconds - (now - hit_times[0])))
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please retry shortly."},
                    headers={"Retry-After": str(retry_after)},
                )

            hit_times.append(now)

            if now - self._last_cleanup > self.window_seconds:
                self._last_cleanup = now
                stale_ips = []
                for key, values in self._hits.items():
                    while values and now - values[0] > self.window_seconds:
                        values.popleft()
                    if not values:
                        stale_ips.append(key)
                for key in stale_ips:
                    del self._hits[key]

        return await call_next(request)
