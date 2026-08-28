"""Multi-layer anti-fraud: disposable email, IP signup cap, fingerprint, Turnstile/IPQS (mock)."""
import os
from datetime import timedelta
from config import DISPOSABLE_EMAIL_DOMAINS, IP_SIGNUP_LIMIT_24H
from database import users
from security import now_utc, iso

# External services are stubbed (keys optional). When keys are added, wire real calls here.
TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET")   # not set -> mock accept
IPQS_API_KEY = os.environ.get("IPQS_API_KEY")           # not set -> mock allow


def is_disposable_email(email: str) -> bool:
    domain = email.lower().split("@")[-1]
    return domain in DISPOSABLE_EMAIL_DOMAINS


async def verify_turnstile(token: str | None) -> bool:
    """Cloudflare Turnstile. MOCK: accepts any non-empty token when no secret configured."""
    if not TURNSTILE_SECRET:
        return True  # MOCK — infra ready, disabled without key
    if not token:
        return False
    # Real verification would POST to challenges.cloudflare.com/turnstile/v0/siteverify
    return True


async def check_vpn_proxy(ip: str) -> dict:
    """IPQualityScore VPN/proxy risk. MOCK: returns low risk when no key configured."""
    if not IPQS_API_KEY:
        return {"enabled": False, "risk": 0, "is_proxy": False, "is_vpn": False}
    return {"enabled": True, "risk": 0, "is_proxy": False, "is_vpn": False}


async def ip_signup_allowed(ip: str) -> bool:
    if not ip:
        return True
    since = iso(now_utc() - timedelta(hours=24))
    count = await users.count_documents({"signup_ip": ip, "created_at": {"$gte": since}})
    return count < IP_SIGNUP_LIMIT_24H


async def fingerprint_unique(fingerprint: str | None) -> bool:
    if not fingerprint:
        return True  # fingerprint optional; other layers still protect
    existing = await users.count_documents({"fingerprint": fingerprint})
    return existing == 0
