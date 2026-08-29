"""Workspace: AI prompt (SSE stream), command feed, bridge/context state, Fix-with-AI."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from database import commands, bridge_state
from models import PromptRequest
from deps import get_verified_user
from rate_limiter import enforce
from ai_agent import run_agent
from config import CREDIT_COST

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.post("/prompt")
async def prompt(body: PromptRequest, user: dict = Depends(get_verified_user)):
    if user.get("credits", 0) <= 0:
        raise HTTPException(status_code=402, detail="No credits remaining. Purchase a credit pack.")
    await enforce(f"user_prompt_min:{user['id']}", "user_prompt_per_min")
    await enforce(f"user_prompt_hour:{user['id']}", "user_prompt_per_hour")

    # merge live studio context if present
    ctx = body.context or {}
    state = await bridge_state.find_one({"user_id": user["id"]}, {"_id": 0})
    if state:
        ctx.setdefault("selection", state.get("selection", []))
        ctx.setdefault("open_script", state.get("open_script"))

    return StreamingResponse(
        run_agent(user, body.prompt, ctx),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


def _estimate_rules():
    c = CREDIT_COST
    return [
        (["map", "terrain", "sculpt", "biome", "mountain", "island"],
         c["sculpt_terrain"] + c["paint_terrain_material"], "terrain generation"),
        (["scatter", "trees", "rocks", "forest", "sakura", "gravel"], c["scatter_assets"], "asset scatter"),
        (["script", "code", "module", "system", "logic"], c["write_script"], "Luau script"),
        (["gui", "ui", "menu", "hud", "button", "frame"], c["create_instance"] * 3, "UI build"),
        (["find", "search", "toolbox", "asset", "model"], c["search_toolbox"], "toolbox search"),
        (["animate", "animation", "tween", "pulse", "rotate", "spin", "fade", "bounce"],
         c["create_animation"], "animation"),
    ]


@router.post("/estimate")
async def estimate(body: PromptRequest, user: dict = Depends(get_verified_user)):
    """Rough heuristic credit estimate for the cost-preview UI (pre-run)."""
    text = body.prompt.lower()
    est, hints = 1, []
    for keywords, cost, hint in _estimate_rules():
        if any(w in text for w in keywords):
            est += cost
            hints.append(hint)
    return {"estimate": est, "hints": hints, "credits": user.get("credits", 0)}


@router.get("/commands")
async def list_commands(user: dict = Depends(get_verified_user)):
    docs = await commands.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return docs


@router.get("/bridge-state")
async def get_bridge_state(user: dict = Depends(get_verified_user)):
    from datetime import datetime, timezone
    state = await bridge_state.find_one({"user_id": user["id"]}, {"_id": 0})
    connected = False
    if state and state.get("last_seen"):
        try:
            last = datetime.fromisoformat(state["last_seen"])
            connected = (datetime.now(timezone.utc) - last).total_seconds() < 8
        except Exception:
            connected = False
    return {
        "connected": connected,
        "selection": (state or {}).get("selection", []),
        "open_script": (state or {}).get("open_script"),
        "last_seen": (state or {}).get("last_seen"),
    }
