"""Projects, prompt history (plan-based retention), billing packages, security page."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException

from database import projects, prompt_history, audit_logs, sessions
from models import ProjectRequest, new_id
from security import now_utc, iso
from deps import get_verified_user, get_current_user
from config import CREDIT_PACKAGES, PLANS

router = APIRouter(prefix="/api", tags=["dashboard"])


# ---------- Projects ----------
@router.get("/projects")
async def list_projects(user: dict = Depends(get_verified_user)):
    return await projects.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("/projects")
async def save_project(body: ProjectRequest, user: dict = Depends(get_verified_user)):
    doc = {"id": new_id(), "user_id": user["id"], "name": body.name, "data": body.data,
           "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
    await projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_verified_user)):
    res = await projects.delete_one({"id": project_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


# ---------- Prompt History (retention by plan) ----------
@router.get("/history")
async def history(user: dict = Depends(get_verified_user)):
    q = {"user_id": user["id"]}
    retention = PLANS.get(user.get("plan", "free"), {}).get("history_days")
    if retention:
        cutoff = iso(now_utc() - timedelta(days=retention))
        q["created_at"] = {"$gte": cutoff}
    return await prompt_history.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- Billing ----------
@router.get("/billing/packages")
async def packages(user: dict = Depends(get_current_user)):
    return {"packages": CREDIT_PACKAGES, "credits": user.get("credits", 0), "plan": user.get("plan", "free")}


@router.get("/billing/ledger")
async def ledger(user: dict = Depends(get_verified_user)):
    docs = await prompt_history.find(
        {"user_id": user["id"], "credits_used": {"$gt": 0}}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [{"created_at": d["created_at"], "prompt": d["prompt"][:80],
             "credits_used": d["credits_used"], "actions": len(d.get("actions", []))} for d in docs]


# ---------- Security ----------
@router.get("/security/audit")
async def audit(user: dict = Depends(get_verified_user)):
    return await audit_logs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/security/sessions")
async def active_sessions(user: dict = Depends(get_verified_user)):
    docs = await sessions.find(
        {"user_id": user["id"], "revoked": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return docs


@router.post("/security/sessions/revoke-all")
async def revoke_all(user: dict = Depends(get_verified_user)):
    await sessions.update_many({"user_id": user["id"]}, {"$set": {"revoked": True}})
    return {"ok": True}
