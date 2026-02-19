from datetime import datetime, timedelta
import hashlib
import bcrypt
from jose import jwt
from app.core.config import settings

_HASH_PREFIX = "bcrypt-sha256$"

def _prehash_password(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_prehash_password(password), bcrypt.gensalt())
    return f"{_HASH_PREFIX}{hashed.decode('utf-8')}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(_HASH_PREFIX):
        stored = hashed_password[len(_HASH_PREFIX):].encode("utf-8")
        return bcrypt.checkpw(_prehash_password(plain_password), stored)
    # Legacy bcrypt hashes without the prefix.
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
