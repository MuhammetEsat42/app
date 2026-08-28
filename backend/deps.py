"""Shared FastAPI dependencies: current user (JWT) + API-key auth (plugin)."""
from fastapi import Depends, HTTPException, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import users, api_keys
from security import decode_token, verify_secret, now_utc, iso, parse_api_key
from rate_limiter import client_ip, enforce
from ip_utils import ip_in_allowlist

bearer = HTTPBearer(auto_error=False)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="Account suspended")
    return user


async def get_verified_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Email not verified")
    return user


async def get_api_key_user(request: Request, x_api_key: str = Header(None)) -> dict:
    """Authenticate the Studio bridge plugin via X-API-Key. Returns {user, key}."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    parsed = parse_api_key(x_api_key)
    if not parsed:
        raise HTTPException(status_code=401, detail="Malformed API key")
    record_id, secret = parsed
    key = await api_keys.find_one({"id": record_id}, {"_id": 0})
    if not key or key.get("revoked"):
        raise HTTPException(status_code=401, detail="Invalid API key")
    if not verify_secret(key["secret_hash"], secret):
        raise HTTPException(status_code=401, detail="Invalid API key")

    ip = client_ip(request)
    allowlist = key.get("ip_allowlist") or []
    if allowlist and not ip_in_allowlist(ip, allowlist):
        raise HTTPException(status_code=403, detail="IP not allowed for this key")

    # per-key poll rate limit
    await enforce(f"key:{record_id}", "key_poll_per_min")

    await api_keys.update_one(
        {"id": record_id},
        {"$set": {"last_used_at": iso(now_utc()), "last_used_ip": ip}},
    )
    user = await users.find_one({"id": key["user_id"]}, {"_id": 0})
    if not user or user.get("suspended"):
        raise HTTPException(status_code=403, detail="Account unavailable")
    return {"user": user, "key": key, "ip": ip}
