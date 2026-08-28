"""Redis sliding-window rate limiter + middleware."""
import time
from fastapi import Request
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from database import redis_client
from config import RATE_LIMITS


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "0.0.0.0"


async def sliding_window(key: str, limit: int, window: int) -> tuple[bool, int]:
    """Returns (allowed, retry_after_seconds). Uses a Redis sorted set."""
    now = time.time()
    member = f"{now}:{time.time_ns()}"
    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zadd(key, {member: now})
    pipe.zcard(key)
    pipe.expire(key, window)
    _, _, count, _ = await pipe.execute()
    if count > limit:
        # find oldest to compute retry-after
        oldest = await redis_client.zrange(key, 0, 0, withscores=True)
        retry = window
        if oldest:
            retry = max(1, int(window - (now - oldest[0][1])))
        return False, retry
    return True, 0


AUTH_PATHS = ("/api/auth/login", "/api/auth/register")


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Skip websocket + stripe webhook + non-api
        if not path.startswith("/api") or path.startswith("/api/ws") or path == "/api/billing/webhook":
            return await call_next(request)

        ip = client_ip(request)

        # Auth endpoints: strict 5/min
        if path in AUTH_PATHS:
            limit, window = RATE_LIMITS["auth_per_min"]
            allowed, retry = await sliding_window(f"rl:auth:{ip}", limit, window)
            if not allowed:
                return _limited(retry)

        # Per-IP global
        for name in ("ip_per_min", "ip_per_hour"):
            limit, window = RATE_LIMITS[name]
            allowed, retry = await sliding_window(f"rl:{name}:{ip}", limit, window)
            if not allowed:
                return _limited(retry)

        return await call_next(request)


def _limited(retry: int) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Slow down."},
        headers={"Retry-After": str(retry)},
    )


async def enforce(key: str, name: str):
    """Helper for per-user / per-key limits inside endpoints. Raises HTTPException 429."""
    from fastapi import HTTPException
    limit, window = RATE_LIMITS[name]
    allowed, retry = await sliding_window(f"rl:{key}", limit, window)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded", headers={"Retry-After": str(retry)})
