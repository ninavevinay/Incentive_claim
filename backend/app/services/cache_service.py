from __future__ import annotations

import logging
from typing import Any, Optional

from app.core.redis import RedisManager

logger = logging.getLogger("api.cache")


class CacheService:
    @staticmethod
    async def get_public_notices() -> Optional[Any]:
        return await RedisManager.get_cache("notices:public")

    @staticmethod
    async def set_public_notices(data: Any) -> None:
        await RedisManager.set_cache("notices:public", data, ttl=600)

    @staticmethod
    async def invalidate_notices() -> None:
        await RedisManager.clear_cache_pattern("notices:*")

    @staticmethod
    async def get_public_highlights() -> Optional[Any]:
        return await RedisManager.get_cache("apps:public_highlights")

    @staticmethod
    async def set_public_highlights(data: Any) -> None:
        await RedisManager.set_cache("apps:public_highlights", data, ttl=600)

    @staticmethod
    async def invalidate_highlights() -> None:
        await RedisManager.clear_cache_pattern("apps:public_highlights*")

    @staticmethod
    async def get_form_window() -> Optional[Any]:
        return await RedisManager.get_cache("form_window")

    @staticmethod
    async def set_form_window(data: Any) -> None:
        await RedisManager.set_cache("form_window", data, ttl=1800)

    @staticmethod
    async def invalidate_form_window() -> None:
        await RedisManager.clear_cache_pattern("form_window*")

    @staticmethod
    async def get_feedback_report() -> Optional[Any]:
        return await RedisManager.get_cache("feedback_report")

    @staticmethod
    async def set_feedback_report(data: Any) -> None:
        await RedisManager.set_cache("feedback_report", data, ttl=600)

    @staticmethod
    async def invalidate_feedback_report() -> None:
        await RedisManager.clear_cache_pattern("feedback_report*")
