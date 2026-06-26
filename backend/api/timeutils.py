from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from django.conf import settings


DEFAULT_TIME_ZONE = "Asia/Kolkata"


@lru_cache(maxsize=1)
def get_portal_timezone() -> ZoneInfo:
    tz_name = str(getattr(settings, "TIME_ZONE", DEFAULT_TIME_ZONE) or DEFAULT_TIME_ZONE).strip()
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo(DEFAULT_TIME_ZONE)


def portal_now() -> datetime:
    return datetime.now(get_portal_timezone()).replace(tzinfo=None)


def portal_now_aware() -> datetime:
    return datetime.now(get_portal_timezone())


def portal_today():
    return portal_now_aware().date()


def portal_datetime_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    tz = get_portal_timezone()
    if value.tzinfo is None:
        value = value.replace(tzinfo=tz)
    else:
        value = value.astimezone(tz)
    return value.isoformat()
