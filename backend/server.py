"""GUI Blox backend — Cloud-to-Studio AI copilot for Roblox. Phase 1 + AI Workspace."""
import os
import logging
from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from database import ensure_indexes, users
from security import decode_token, hash_secret, now_utc, iso
from models import new_user_doc
from rate_limiter import RateLimitMiddleware
from ws_manager import manager
from config import FREE_SIGNUP_CREDITS

from routers import auth, apikeys, bridge, workspace, dashboard

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("guiblox")

app = FastAPI(title="GUI Blox API")


# ---- HTTP security headers (Helmet-style) ----
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return resp


api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "GUI Blox", "status": "online", "version": "2.2"}


@api.get("/health")
async def health():
    return {"ok": True}


app.include_router(api)
app.include_router(auth.router)
app.include_router(apikeys.router)
app.include_router(bridge.router)
app.include_router(workspace.router)
app.include_router(dashboard.router)


# ---- WebSocket live log/status stream (token via query param) ----
@app.websocket("/api/ws/logs")
async def ws_logs(websocket: WebSocket, token: str = ""):
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4401)
        return
    await manager.connect(user_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "message": "GUI Blox log stream online"})
        while True:
            await websocket.receive_text()  # keep-alive / client pings
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)


# ---- Middleware order: security headers -> rate limit -> CORS (outermost) ----
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],
)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await _seed_test_user()
    logger.info("GUI Blox backend ready")


async def _seed_test_user():
    email = "test@guiblox.com"
    if await users.find_one({"email": email}):
        return
    doc = new_user_doc(email, hash_secret("Test1234!"), "seed-fingerprint", "127.0.0.1", "000000")
    doc["email_verified"] = True
    doc["verification_code"] = None
    doc["credits"] = 200
    doc["free_credit_granted"] = True
    doc["plan"] = "studio"
    await users.insert_one(doc)
    logger.info("Seeded test user test@guiblox.com")
