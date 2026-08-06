from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional
import redis.asyncio as aioredis

from .config import settings

logger = logging.getLogger("api.redis")

_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> Optional[aioredis.Redis]:
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        await _redis_client.ping()
        logger.info("Connected to Redis successfully.")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}). Continuing with in-memory fallback where applicable.")
        _redis_client = None
        return None


async def close_redis():
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception:
            pass
        _redis_client = None


class RedisManager:
    @staticmethod
    def _full_key(key: str) -> str:
        return f"{settings.REDIS_PREFIX}{key}"

    @classmethod
    async def get_cache(cls, key: str) -> Optional[Any]:
        r = await get_redis_client()
        if not r:
            return None
        try:
            val = await r.get(cls._full_key(key))
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get_cache error for key {key}: {e}")
        return None

    @classmethod
    async def set_cache(cls, key: str, value: Any, ttl: int = settings.CACHE_DEFAULT_TTL) -> bool:
        r = await get_redis_client()
        if not r:
            return False
        try:
            full_k = cls._full_key(key)
            dumped = json.dumps(value, default=str)
            await r.set(full_k, dumped, ex=ttl)
            return True
        except Exception as e:
            logger.warning(f"Redis set_cache error for key {key}: {e}")
            return False

    @classmethod
    async def clear_cache_pattern(cls, pattern: str) -> int:
        r = await get_redis_client()
        if not r:
            return 0
        try:
            match_pattern = cls._full_key(pattern)
            keys = await r.keys(match_pattern)
            if keys:
                return await r.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis clear_cache_pattern error for pattern {pattern}: {e}")
        return 0

    @classmethod
    async def blacklist_token(cls, token: str, expire_seconds: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60) -> bool:
        r = await get_redis_client()
        if not r:
            return False
        try:
            key = cls._full_key(f"bl_token:{token}")
            await r.set(key, "1", ex=max(60, expire_seconds))
            return True
        except Exception as e:
            logger.warning(f"Redis blacklist_token error: {e}")
            return False

    @classmethod
    async def is_token_blacklisted(cls, token: str) -> bool:
        r = await get_redis_client()
        if not r:
            return False
        try:
            key = cls._full_key(f"bl_token:{token}")
            return bool(await r.exists(key))
        except Exception as e:
            logger.warning(f"Redis is_token_blacklisted error: {e}")
            return False

    @classmethod
    async def check_rate_limit(cls, identifier: str, limit: int, window_seconds: int) -> tuple[bool, int, int]:
        r = await get_redis_client()
        if not r:
            return True, limit, 0

        try:
            now = time.time()
            clear_before = now - window_seconds
            key = cls._full_key(f"ratelimit:{identifier}")

            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, clear_before)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window_seconds + 5)
            results = await pipe.execute()

            request_count = results[2]
            allowed = request_count <= limit
            remaining = max(0, limit - request_count)
            return allowed, remaining, window_seconds
        except Exception as e:
            logger.warning(f"Redis check_rate_limit error for {identifier}: {e}")
            return True, limit, 0

    @classmethod
    async def set_otp_cooldown(cls, email: str, purpose: str, seconds: int = settings.OTP_RESEND_SECONDS) -> bool:
        r = await get_redis_client()
        if not r:
            return False
        try:
            key = cls._full_key(f"otp_cooldown:{email}:{purpose}")
            await r.set(key, "1", ex=seconds)
            return True
        except Exception:
            return False

    @classmethod
    async def has_otp_cooldown(cls, email: str, purpose: str) -> bool:
        r = await get_redis_client()
        if not r:
            return False
        try:
            key = cls._full_key(f"otp_cooldown:{email}:{purpose}")
            return bool(await r.exists(key))
        except Exception:
            return False
