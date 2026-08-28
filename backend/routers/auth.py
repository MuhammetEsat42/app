"""Auth: register + mock email verification + login + JWT refresh rotation + logout."""
import random
from fastapi import APIRouter, HTTPException, Request, Depends

from database import users, sessions
from models import (RegisterRequest, LoginRequest, VerifyEmailRequest, RefreshRequest,
                    TokenResponse, UserPublic, new_user_doc, new_id)
from security import (hash_secret, verify_secret, create_access_token,
                      create_refresh_token, decode_token, now_utc, iso)
from rate_limiter import client_ip
from anti_fraud import (is_disposable_email, verify_turnstile, ip_signup_allowed,
                        fingerprint_unique, check_vpn_proxy)
from audit import log_audit
from config import FREE_SIGNUP_CREDITS
from deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(body: RegisterRequest, request: Request):
    ip = client_ip(request)
    email = body.email.lower()

    if is_disposable_email(email):
        raise HTTPException(status_code=400, detail="Disposable email addresses are not allowed")
    if not await verify_turnstile(body.turnstile_token):
        raise HTTPException(status_code=400, detail="Captcha verification failed")
    if not await ip_signup_allowed(ip):
        raise HTTPException(status_code=429, detail="Signup limit reached for this network (max 2 / 24h)")
    if not await fingerprint_unique(body.fingerprint):
        raise HTTPException(status_code=409, detail="This device already has an account")

    if await users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    vpn = await check_vpn_proxy(ip)  # infra ready (mock)
    code = f"{random.randint(0, 999999):06d}"
    doc = new_user_doc(email, hash_secret(body.password), body.fingerprint, ip, code)
    doc["vpn_check"] = vpn
    await users.insert_one(doc)
    await log_audit(doc["id"], "register", ip, {"email": email})

    # MOCK email verification — code returned in response + logged (real email later)
    return {
        "message": "Registered. Verify your email to activate 5 free credits.",
        "email": email,
        "verification_code_mock": code,  # MOCKED: shown in-UI until real email is wired
    }


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(body: VerifyEmailRequest, request: Request):
    email = body.email.lower()
    user = await users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")
    if body.code != user.get("verification_code"):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    update = {"email_verified": True, "verification_code": None}
    if not user.get("free_credit_granted"):
        update["credits"] = FREE_SIGNUP_CREDITS
        update["free_credit_granted"] = True
    await users.update_one({"id": user["id"]}, {"$set": update})
    await log_audit(user["id"], "email_verified", client_ip(request))
    return await _issue_tokens(user["id"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    user = await users.find_one({"email": body.email.lower()})
    if not user or not verify_secret(user["password_hash"], body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="Account suspended")
    await log_audit(user["id"], "login", client_ip(request))
    return await _issue_tokens(user["id"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    jti = payload.get("jti")
    stored = await sessions.find_one({"jti": jti, "user_id": payload["sub"]})
    if not stored or stored.get("revoked"):
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    # rotation: revoke old, issue new
    await sessions.update_one({"jti": jti}, {"$set": {"revoked": True}})
    return await _issue_tokens(payload["sub"])


@router.post("/logout")
async def logout(body: RefreshRequest, user: dict = Depends(get_current_user)):
    try:
        payload = decode_token(body.refresh_token)
        await sessions.update_one({"jti": payload.get("jti")}, {"$set": {"revoked": True}})
    except Exception:
        pass
    return {"message": "Logged out"}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)


async def _issue_tokens(user_id: str) -> TokenResponse:
    jti = new_id()
    await sessions.insert_one({
        "jti": jti, "user_id": user_id, "revoked": False, "created_at": iso(now_utc()),
    })
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, jti),
    )
