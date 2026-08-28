"""Audit logging helper."""
from database import audit_logs
from security import now_utc, iso
from models import new_id


async def log_audit(user_id: str | None, action: str, ip: str | None = None, meta: dict | None = None):
    await audit_logs.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "action": action,
        "ip": ip,
        "meta": meta or {},
        "created_at": iso(now_utc()),
    })
