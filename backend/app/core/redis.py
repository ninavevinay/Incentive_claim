from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional
import redis.asyncio as aioredis

from .config import settings

logger = logging.getLogger("api.redis")

_redis_client: Optional[Any] = None
_is_fake: bool = False


async def _create_fallback_client() -> Optional[Any]:
    global _is_fake
    try:
        import fakeredis.aioredis as fake_aioredis
        client = fake_aioredis.FakeRedis(decode_responses=True)
        _is_fake = True
        logger.info("Using in-memory FakeRedis fallback for caching and rate-limiting.")
        return client
    except Exception as e:
        logger.warning(f"Could not initialize FakeRedis fallback: {e}")
        _is_fake = False
        return None


async def get_redis_client() -> Optional[Any]:
    global _redis_client, _is_fake
    if _redis_client is not None:
        return _redis_client
    try:
        client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        await client.ping()
        logger.info("Connected to Redis successfully.")
        _redis_client = client
        _is_fake = False
        return _redis_client
    except Exception as e:
        logger.info(f"Real Redis unavailable ({e}). Switching to in-memory FakeRedis fallback.")
        _redis_client = await _create_fallback_client()
        return _redis_client


async def close_redis():
    global _redis_client, _is_fake
    if _redis_client is not None:
        try:
            if not _is_fake and hasattr(_redis_client, "close"):
                await _redis_client.close()
        except Exception:
            pass
        _redis_client = None
        _is_fake = False


class RedisManager:
    @staticmethod
    def _full_key(key: str) -> str:
        return f"{settings.REDIS_PREFIX}{key}"

    @classmethod
    async def _on_error(cls, e: Exception, key_info: str = ""):
        global _redis_client, _is_fake
        if not _is_fake:
            logger.warning(f"Redis operation error for {key_info} ({e}). Switching to FakeRedis fallback.")
            _redis_client = await _create_fallback_client()

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
            await cls._on_error(e, key)
            if _is_fake and _redis_client:
                try:
                    val = await _redis_client.get(cls._full_key(key))
                    if val:
                        return json.loads(val)
                except Exception:
                    pass
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
            await cls._on_error(e, key)
            if _is_fake and _redis_client:
                try:
                    full_k = cls._full_key(key)
                    dumped = json.dumps(value, default=str)
                    await _redis_client.set(full_k, dumped, ex=ttl)
                    return True
                except Exception:
                    pass
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
            await cls._on_error(e, pattern)
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
            await cls._on_error(e, "blacklist_token")
            if _is_fake and _redis_client:
                try:
                    key = cls._full_key(f"bl_token:{token}")
                    await _redis_client.set(key, "1", ex=max(60, expire_seconds))
                    return True
                except Exception:
                    pass
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
            await cls._on_error(e, "is_token_blacklisted")
            if _is_fake and _redis_client:
                try:
                    key = cls._full_key(f"bl_token:{token}")
                    return bool(await _redis_client.exists(key))
                except Exception:
                    pass
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
            await cls._on_error(e, identifier)
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
        except Exception as e:
            await cls._on_error(e, "set_otp_cooldown")
            return False

    @classmethod
    async def has_otp_cooldown(cls, email: str, purpose: str) -> bool:
        r = await get_redis_client()
        if not r:
            return False
        try:
            key = cls._full_key(f"otp_cooldown:{email}:{purpose}")
            return bool(await r.exists(key))
        except Exception as e:
            await cls._on_error(e, "has_otp_cooldown")
            return False

