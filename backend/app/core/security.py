from datetime import datetime, timedelta
import hashlib
import secrets
import bcrypt
from jose import jwt
from app.core.config import settings

_HASH_PREFIX = "bcrypt-sha256$"
_AUTH_PLACEHOLDER_PREFIX = "email-otp$"


def _prehash_password(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_prehash_password(password), bcrypt.gensalt())
    return f"{_HASH_PREFIX}{hashed.decode('utf-8')}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(_HASH_PREFIX):
        stored = hashed_password[len(_HASH_PREFIX):].encode("utf-8")
        return bcrypt.checkpw(_prehash_password(plain_password), stored)
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def is_allowed_email(email: str) -> bool:
    return normalize_email(email).endswith(f"@{settings.allowed_email_domain}")


def make_auth_placeholder(subject: str) -> str:
    digest = hashlib.sha256(str(subject or "").encode("utf-8")).hexdigest()
    return f"{_AUTH_PLACEHOLDER_PREFIX}{digest}"


def generate_numeric_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))


def hash_otp(email: str, purpose: str, otp: str) -> str:
    normalized_email = normalize_email(email)
    raw = f"{normalized_email}:{purpose}:{otp}:{settings.secret_key}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
