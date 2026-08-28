"""Team collaboration — invite teammates with View / Edit roles (Pro / Studio only)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from database import team_invites, users
from deps import get_verified_user
from config import PLANS
from audit import log_audit
from rate_limiter import client_ip
from security import now_utc, iso
from models import new_id

router = APIRouter(prefix="/api/team", tags=["team"])

ROLES = {"view", "edit"}


class InviteBody(BaseModel):
    email: EmailStr
    role: str = "view"


class RoleBody(BaseModel):
    role: str = "view"


def _require_team(user: dict):
    plan = PLANS.get(user.get("plan", "free"), PLANS["free"])
    if not plan.get("team"):
        raise HTTPException(status_code=403, detail="Team sharing requires the Professional or Studio plan")


@router.get("/members")
async def members(user: dict = Depends(get_verified_user)):
    invites = await team_invites.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    owner = {"email": user["email"], "role": "owner", "status": "active"}
    return {"owner": owner, "members": invites, "can_manage": PLANS.get(user.get("plan", "free"), {}).get("team", False)}


@router.post("/invite")
async def invite(body: InviteBody, request: Request, user: dict = Depends(get_verified_user)):
    _require_team(user)
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail="Role must be 'view' or 'edit'")
    email = body.email.lower()
    if email == user["email"]:
        raise HTTPException(status_code=400, detail="You can't invite yourself")
    existing = await team_invites.find_one({"owner_id": user["id"], "email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Already invited")
    doc = {
        "id": new_id(), "owner_id": user["id"], "email": email, "role": body.role,
        "status": "pending", "created_at": iso(now_utc()),
    }
    await team_invites.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user["id"], "team_invite", client_ip(request), {"email": email, "role": body.role})
    return doc


@router.put("/invite/{invite_id}")
async def update_role(invite_id: str, body: RoleBody, user: dict = Depends(get_verified_user)):
    _require_team(user)
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    res = await team_invites.update_one(
        {"id": invite_id, "owner_id": user["id"]}, {"$set": {"role": body.role}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"ok": True}


@router.delete("/invite/{invite_id}")
async def remove(invite_id: str, user: dict = Depends(get_verified_user)):
    _require_team(user)
    res = await team_invites.delete_one({"id": invite_id, "owner_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"ok": True}
