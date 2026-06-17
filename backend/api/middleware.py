from __future__ import annotations

from collections import deque
from threading import Lock
from time import monotonic

from django.conf import settings
from django.http import HttpResponse, JsonResponse


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Credentials"] = "false"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, User-Agent, X-Requested-With"
        response["Vary"] = "Origin"
        return response


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.max_requests = settings.RATE_LIMIT_MAX_REQUESTS
        self.window_seconds = settings.RATE_LIMIT_WINDOW_SECONDS
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()
        self._last_cleanup = monotonic()

    def _client_ip(self, request) -> str:
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
            if ip:
                return ip
        return request.META.get("REMOTE_ADDR", "unknown")

    def __call__(self, request):
        if not settings.RATE_LIMIT_ENABLED:
            return self.get_response(request)

        if request.method == "OPTIONS":
            return self.get_response(request)

        path = request.path
        if path in {"/", "/health", "/api/health"} or path.startswith("/uploads/"):
            return self.get_response(request)

        now = monotonic()
        ip = self._client_ip(request)

        with self._lock:
            hit_times = self._hits.setdefault(ip, deque())
            while hit_times and now - hit_times[0] > self.window_seconds:
                hit_times.popleft()

            if len(hit_times) >= self.max_requests:
                retry_after = max(1, int(self.window_seconds - (now - hit_times[0])))
                return JsonResponse(
                    {"detail": "Too many requests. Please retry shortly."},
                    status=429,
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

        return self.get_response(request)

