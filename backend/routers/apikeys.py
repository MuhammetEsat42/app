"""API key management — Argon2id-hashed, one-time reveal, IP allowlist, revoke/regenerate."""
from fastapi import APIRouter, HTTPException, Request, Depends

from database import api_keys
from models import CreateKeyRequest, UpdateKeyRequest, new_id
from security import new_api_key, now_utc, iso
from deps import get_verified_user
from rate_limiter import client_ip
from audit import log_audit
from config import MAX_ACTIVE_KEYS, PLANS

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


def _public(k: dict) -> dict:
    return {
        "id": k["id"],
        "name": k["name"],
        "masked": k["masked"],
        "ip_allowlist": k.get("ip_allowlist", []),
        "revoked": k.get("revoked", False),
        "created_at": k["created_at"],
        "last_used_at": k.get("last_used_at"),
        "last_used_ip": k.get("last_used_ip"),
    }


@router.get("")
async def list_keys(user: dict = Depends(get_verified_user)):
    docs = await api_keys.find({"user_id": user["id"]}, {"_id": 0, "secret_hash": 0}).to_list(50)
    return [_public(k) for k in docs]


@router.post("")
async def create_key(body: CreateKeyRequest, request: Request, user: dict = Depends(get_verified_user)):
    plan = PLANS.get(user.get("plan", "free"), PLANS["free"])
    cap = min(plan.get("max_keys", MAX_ACTIVE_KEYS), MAX_ACTIVE_KEYS)
    active = await api_keys.count_documents({"user_id": user["id"], "revoked": {"$ne": True}})
    if active >= cap:
        raise HTTPException(status_code=400, detail=f"Your {plan['name']} plan allows max {cap} active keys")

    ip_allowlist = body.ip_allowlist
    if ip_allowlist and not plan.get("ip_allowlist"):
        raise HTTPException(status_code=403, detail="IP allowlisting requires the Professional or Studio plan")

    record_id, full_key, secret_hash, last4 = new_api_key()
    masked = f"gb_{record_id[:4]}…{last4}"
    doc = {
        "id": record_id,
        "user_id": user["id"],
        "name": body.name,
        "secret_hash": secret_hash,
        "masked": masked,
        "ip_allowlist": ip_allowlist,
        "revoked": False,
        "created_at": iso(now_utc()),
        "last_used_at": None,
        "last_used_ip": None,
    }
    await api_keys.insert_one(doc)
    await log_audit(user["id"], "key_create", client_ip(request), {"key_id": record_id, "name": body.name})
    # full_key returned ONCE only
    return {"key": _public(doc), "full_key": full_key}


@router.put("/{key_id}")
async def update_key(key_id: str, body: UpdateKeyRequest, request: Request, user: dict = Depends(get_verified_user)):
    k = await api_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    plan = PLANS.get(user.get("plan", "free"), PLANS["free"])
    if body.ip_allowlist and not plan.get("ip_allowlist"):
        raise HTTPException(status_code=403, detail="IP allowlisting requires the Professional or Studio plan")
    await api_keys.update_one({"id": key_id}, {"$set": {"ip_allowlist": body.ip_allowlist}})
    await log_audit(user["id"], "key_ip_update", client_ip(request), {"key_id": key_id, "allowlist": body.ip_allowlist})
    updated = await api_keys.find_one({"id": key_id}, {"_id": 0, "secret_hash": 0})
    return _public(updated)


@router.post("/{key_id}/revoke")
async def revoke_key(key_id: str, request: Request, user: dict = Depends(get_verified_user)):
    k = await api_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    await api_keys.update_one({"id": key_id}, {"$set": {"revoked": True}})
    await log_audit(user["id"], "key_revoke", client_ip(request), {"key_id": key_id})
    return {"message": "Key revoked"}


@router.post("/{key_id}/regenerate")
async def regenerate_key(key_id: str, request: Request, user: dict = Depends(get_verified_user)):
    k = await api_keys.find_one({"id": key_id, "user_id": user["id"]})
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    record_id, full_key, secret_hash, last4 = new_api_key()
    masked = f"gb_{record_id[:4]}…{last4}"
    # keep same document id? regenerate creates fresh secret + new record id; retire old
    await api_keys.update_one({"id": key_id}, {"$set": {"revoked": True}})
    doc = {
        "id": record_id, "user_id": user["id"], "name": k["name"] + " (rotated)",
        "secret_hash": secret_hash, "masked": masked, "ip_allowlist": k.get("ip_allowlist", []),
        "revoked": False, "created_at": iso(now_utc()), "last_used_at": None, "last_used_ip": None,
    }
    await api_keys.insert_one(doc)
    await log_audit(user["id"], "key_regenerate", client_ip(request), {"old": key_id, "new": record_id})
    return {"key": _public(doc), "full_key": full_key}
