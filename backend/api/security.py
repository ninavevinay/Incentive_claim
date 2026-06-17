from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

import bcrypt
from django.conf import settings
from jose import jwt


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
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def normalize_email(email: str | None) -> str:
    return str(email or "").strip().lower()


def is_allowed_email(email: str | None) -> bool:
    return normalize_email(email).endswith(f"@{settings.ALLOWED_EMAIL_DOMAIN}")


def make_auth_placeholder(subject: str) -> str:
    digest = hashlib.sha256(str(subject or "").encode("utf-8")).hexdigest()
    return f"{_AUTH_PLACEHOLDER_PREFIX}{digest}"


def generate_numeric_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(settings.OTP_LENGTH))


def hash_otp(email: str, purpose: str, otp: str) -> str:
    normalized_email = normalize_email(email)
    raw = f"{normalized_email}:{purpose}:{otp}:{settings.SECRET_KEY}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

