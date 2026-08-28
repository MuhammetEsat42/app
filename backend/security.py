"""Argon2id password/key hashing + JWT rotation helpers."""
import os
import uuid
import hmac
import secrets
from datetime import datetime, timezone, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher()  # Argon2id defaults

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_MIN = int(os.environ.get("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_DAYS = int(os.environ.get("REFRESH_TOKEN_DAYS", "7"))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---- Argon2id ----
def hash_secret(raw: str) -> str:
    return _ph.hash(raw)


def verify_secret(hashed: str, raw: str) -> bool:
    try:
        return _ph.verify(hashed, raw)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


# ---- JWT ----
def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": now_utc(),
        "exp": now_utc() + timedelta(minutes=ACCESS_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(user_id: str, jti: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": jti,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(days=REFRESH_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


# ---- API key generation (gb_<record_id>.<secret>) ----
def new_api_key() -> tuple[str, str, str, str]:
    """Returns (record_id, full_key, secret_hash, last4)."""
    record_id = uuid.uuid4().hex[:12]
    secret = secrets.token_urlsafe(32)
    full_key = f"gb_{record_id}.{secret}"
    return record_id, full_key, hash_secret(secret), secret[-4:]


def parse_api_key(full_key: str) -> tuple[str, str] | None:
    """Parse 'gb_<record_id>.<secret>' -> (record_id, secret)."""
    if not full_key or not full_key.startswith("gb_"):
        return None
    rest = full_key[3:]
    rid, sep, secret = rest.partition(".")
    if not sep or not rid or not secret:
        return None
    return rid, secret
