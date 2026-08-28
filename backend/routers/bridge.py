"""Cloud-to-Studio bridge: plugin polling, results, context sync, logs, heartbeat."""
from fastapi import APIRouter, Depends, Request

from database import commands, bridge_state, prompt_history
from models import BridgeResult, BridgeContext, BridgeLog, new_id
from security import now_utc, iso
from deps import get_api_key_user
from ws_manager import manager

router = APIRouter(prefix="/api/bridge", tags=["bridge"])


@router.post("/poll")
async def poll(ctx=Depends(get_api_key_user)):
    """Plugin polls every 2s. Claims queued commands, marks in_progress."""
    user = ctx["user"]
    now = iso(now_utc())
    # mark bridge connected
    await bridge_state.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "connected": True, "last_seen": now,
                  "ip": ctx["ip"], "key_id": ctx["key"]["id"]}},
        upsert=True,
    )
    await manager.broadcast(user["id"], {"type": "studio_status", "connected": True, "at": now})

    docs = await commands.find(
        {"user_id": user["id"], "status": "queued"}, {"_id": 0}
    ).sort("created_at", 1).to_list(20)
    ids = [d["id"] for d in docs]
    if ids:
        await commands.update_many(
            {"id": {"$in": ids}}, {"$set": {"status": "in_progress", "claimed_at": now}}
        )
        for d in docs:
            await manager.broadcast(user["id"], {
                "type": "command_status", "command_id": d["id"],
                "status": "in_progress", "tool": d["type"],
            })
    return {
        "commands": [{"id": d["id"], "type": d["type"], "payload": d["payload"]} for d in docs],
        "credits": user.get("credits", 0),
        "poll_interval": 2,
    }


@router.post("/result")
async def result(body: BridgeResult, ctx=Depends(get_api_key_user)):
    user = ctx["user"]
    now = iso(now_utc())
    await commands.update_one(
        {"id": body.command_id, "user_id": user["id"]},
        {"$set": {"status": body.status, "result": body.result, "error": body.error,
                  "logs": body.logs, "finished_at": now}},
    )
    for line in body.logs:
        await manager.broadcast(user["id"], {"type": "log", "level": "info", "message": line, "source": "studio"})
    if body.status == "error" and body.error:
        await manager.broadcast(user["id"], {"type": "log", "level": "error",
                                             "message": body.error, "source": "studio",
                                             "command_id": body.command_id, "fixable": True})
    await manager.broadcast(user["id"], {"type": "command_status", "command_id": body.command_id,
                                         "status": body.status})
    return {"ok": True}


@router.post("/context")
async def context(body: BridgeContext, ctx=Depends(get_api_key_user)):
    user = ctx["user"]
    await bridge_state.update_one(
        {"user_id": user["id"]},
        {"$set": {"selection": body.selection, "open_script": body.open_script,
                  "last_seen": iso(now_utc())}},
        upsert=True,
    )
    await manager.broadcast(user["id"], {"type": "context", "selection": body.selection,
                                         "open_script": body.open_script})
    return {"ok": True}


@router.post("/log")
async def log(body: BridgeLog, ctx=Depends(get_api_key_user)):
    user = ctx["user"]
    await manager.broadcast(user["id"], {"type": "log", "level": body.level,
                                         "message": body.message, "source": body.source,
                                         "fixable": body.level == "error"})
    return {"ok": True}
