from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from .config import settings

_HASH_PREFIX = "bcrypt-sha256$"
_AUTH_PLACEHOLDER_PREFIX = "email-otp$"


def _prehash_password(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_prehash_password(password), bcrypt.gensalt())
    return f"{_HASH_PREFIX}{hashed.decode('utf-8')}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if str(hashed_password or "").startswith(_HASH_PREFIX):
        stored = str(hashed_password)[len(_HASH_PREFIX) :].encode("utf-8")
        return bcrypt.checkpw(_prehash_password(plain_password), stored)
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), str(hashed_password).encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


def normalize_email(email: str | None) -> str:
    return str(email or "").strip().lower()


def is_allowed_email(email: str | None) -> bool:
    norm = normalize_email(email)
    if not norm or "@" not in norm or "." not in norm.split("@")[-1]:
        return False
    domain = str(settings.ALLOWED_EMAIL_DOMAIN or "").strip()
    if not domain or domain == "*":
        return True
    return norm.endswith(f"@{domain}")


def make_auth_placeholder(subject: str) -> str:
    digest = hashlib.sha256(str(subject or "").encode("utf-8")).hexdigest()
    return f"{_AUTH_PLACEHOLDER_PREFIX}{digest}"


def generate_numeric_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(settings.OTP_LENGTH))


def hash_otp(email: str, purpose: str, otp: str) -> str:
    normalized_email = normalize_email(email)
    raw = f"{normalized_email}:{purpose}:{otp}:{settings.SECRET_KEY}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
