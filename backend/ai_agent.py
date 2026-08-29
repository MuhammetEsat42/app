"""GUI Blox AI agent — Claude Sonnet 4.6 tool-calling planner.

Turns a natural-language prompt into an ordered action plan. Each tool call is
queued as a Command for the GUI Blox Connect plugin to execute in Studio.
Streams reasoning tokens + structured actions over SSE.
"""
import os
import re
import json
from typing import AsyncGenerator

from emergentintegrations.llm.chat import (
    LlmChat, UserMessage, TextDelta, ToolCallStart, ToolCallReady, StreamDone,
)

from config import CREDIT_COST, HARD_LIMITS, MODEL_PLANNER
from database import commands
from security import now_utc, iso
from models import new_id

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

SYSTEM_PROMPT = """You are GUI Blox, a senior Roblox engineer copilot operating a Cloud-to-Studio bridge.
You do NOT write prose essays. You translate a builder's request into a precise, ordered execution plan.
Rules:
- Speak like a senior Roblox engineer: terse, technical, performance-aware. Zero filler.
- Prefer modern Luau: strict typing, task.wait() over wait(), ModuleScripts, RaycastParams, TweenService.
- Use the provided tools to enact EVERY concrete change. Never describe a change you could make with a tool.
- Group work logically: create instances, then modify properties, then scripts, then terrain/scatter.
- Respect hard-limits (<=100 instances/action, terrain region <=512 studs, <=500 scatter points).
- For maps: sculpt terrain first, paint biome materials, then scatter assets (trees, rocks) with jitter.
- Briefly state your plan in 1-2 sentences, then call tools. After tools, give a one-line summary."""

TOOLS = [
    {"type": "function", "function": {
        "name": "create_instance",
        "description": "Create a new Roblox Instance (Part, Model, Folder, ScreenGui, Frame, etc.).",
        "parameters": {"type": "object", "properties": {
            "class_name": {"type": "string", "description": "Roblox class, e.g. Part, Model, ScreenGui, Frame, TextButton"},
            "name": {"type": "string"},
            "parent": {"type": "string", "description": "Parent path, e.g. Workspace, StarterGui, ReplicatedStorage"},
            "properties": {"type": "object", "description": "Initial properties map (Size, Position, Color, etc.)"},
        }, "required": ["class_name", "name", "parent"]},
    }},
    {"type": "function", "function": {
        "name": "modify_property",
        "description": "Modify one or more properties of an existing instance selected in Studio or by path.",
        "parameters": {"type": "object", "properties": {
            "target": {"type": "string", "description": "Instance path or 'Selection'"},
            "properties": {"type": "object"},
        }, "required": ["target", "properties"]},
    }},
    {"type": "function", "function": {
        "name": "write_script",
        "description": "Generate a modern strict-typed Luau script/ModuleScript and place it.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "script_type": {"type": "string", "enum": ["Script", "LocalScript", "ModuleScript"]},
            "parent": {"type": "string"},
            "source": {"type": "string", "description": "Full Luau source code, strict typing, task.wait()"},
        }, "required": ["name", "script_type", "parent", "source"]},
    }},
    {"type": "function", "function": {
        "name": "search_toolbox",
        "description": "Search the Roblox Toolbox/Marketplace for a verified asset.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"},
            "verified_only": {"type": "boolean"},
        }, "required": ["query"]},
    }},
    {"type": "function", "function": {
        "name": "insert_toolbox_model",
        "description": "Insert a Toolbox model by assetId (scripts disabled on import).",
        "parameters": {"type": "object", "properties": {
            "asset_id": {"type": "integer"},
            "parent": {"type": "string"},
        }, "required": ["asset_id", "parent"]},
    }},
    {"type": "function", "function": {
        "name": "sculpt_terrain",
        "description": "Procedurally sculpt terrain in a bounding region using a Perlin heightmap (FillRegion/FillBall).",
        "parameters": {"type": "object", "properties": {
            "region_size": {"type": "array", "items": {"type": "number"}, "description": "[x,y,z] studs, each <=512"},
            "center": {"type": "array", "items": {"type": "number"}},
            "amplitude": {"type": "number"},
            "material": {"type": "string", "description": "Base material e.g. Grass, Rock, Sand"},
        }, "required": ["region_size", "material"]},
    }},
    {"type": "function", "function": {
        "name": "paint_terrain_material",
        "description": "Paint biome-aware materials over a terrain region (PaintRegion).",
        "parameters": {"type": "object", "properties": {
            "region_size": {"type": "array", "items": {"type": "number"}},
            "center": {"type": "array", "items": {"type": "number"}},
            "biome": {"type": "string", "description": "e.g. forest, desert, snow, volcanic"},
            "materials": {"type": "array", "items": {"type": "string"}},
        }, "required": ["biome", "materials"]},
    }},
    {"type": "function", "function": {
        "name": "scatter_assets",
        "description": "Poisson-disk scatter of assets over terrain with jitter, terrain-conforming placement.",
        "parameters": {"type": "object", "properties": {
            "asset": {"type": "string", "description": "e.g. SakuraTree, Rock, GrassPatch, or Toolbox assetId"},
            "count": {"type": "integer", "description": "<=500"},
            "region_size": {"type": "array", "items": {"type": "number"}},
            "center": {"type": "array", "items": {"type": "number"}},
            "min_spacing": {"type": "number"},
            "jitter": {"type": "number"},
        }, "required": ["asset", "count"]},
    }},
    {"type": "function", "function": {
        "name": "create_animation",
        "description": "Animate an instance with TweenService — position, rotation, size, color or transparency over time.",
        "parameters": {"type": "object", "properties": {
            "target": {"type": "string", "description": "Instance path or 'Selection'"},
            "goal": {"type": "object", "description": "Target property values, e.g. {Transparency: 1, Position: [0,10,0]}"},
            "duration": {"type": "number", "description": "Seconds"},
            "easing_style": {"type": "string", "description": "e.g. Quad, Sine, Back, Elastic"},
            "easing_direction": {"type": "string", "enum": ["In", "Out", "InOut"]},
            "repeat_count": {"type": "integer", "description": "-1 for infinite"},
            "reverses": {"type": "boolean"},
        }, "required": ["target", "goal", "duration"]},
    }},
]


def sanitize_prompt(text: str) -> str:
    """Neutralize prompt-injection attempts before hitting the LLM."""
    patterns = [
        r"ignore (all |previous |the above )?(instructions|prompts?)",
        r"disregard (the )?(system|previous) (prompt|instructions?)",
        r"you are now",
        r"reveal (your )?(system )?prompt",
        r"forget (everything|all previous)",
    ]
    cleaned = text
    for p in patterns:
        cleaned = re.sub(p, "[filtered]", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()[:4000]


def clamp_hard_limits(name: str, args: dict) -> dict:
    """Enforce executor hard-limits server-side before queueing."""
    if name == "scatter_assets" and "count" in args:
        args["count"] = min(int(args.get("count") or 0), HARD_LIMITS["max_scatter"])
    if name in ("sculpt_terrain", "paint_terrain_material") and args.get("region_size"):
        cap = HARD_LIMITS["max_terrain_region"]
        args["region_size"] = [min(float(v), cap) for v in args["region_size"]]
    return args


async def _queue_command(user_id: str, key_id: str | None, tool: str, args: dict, cost: int) -> str:
    cid = new_id()
    await commands.insert_one({
        "id": cid,
        "user_id": user_id,
        "api_key_id": key_id,
        "type": tool,
        "payload": args,
        "cost": cost,
        "status": "queued",
        "result": None,
        "logs": [],
        "created_at": iso(now_utc()),
        "claimed_at": None,
        "finished_at": None,
    })
    return cid


def _build_context_string(context: dict | None) -> str:
    if not context:
        return ""
    parts = []
    sel = context.get("selection") or []
    if sel:
        parts.append(f"\nCurrent Studio selection: {', '.join(sel)}.")
    if context.get("open_script"):
        parts.append(f"\nOpen script: {context['open_script']}.")
    return "".join(parts)


def _parse_args(tc) -> dict:
    try:
        return tc.arguments if isinstance(tc.arguments, dict) else json.loads(tc.arguments)
    except Exception:
        return {}


async def _charge_credits(users_col, user_id: str, cost: int) -> tuple[bool, int]:
    """Atomic conditional deduction. Returns (ok, remaining_if_failed)."""
    res = await users_col.update_one(
        {"id": user_id, "credits": {"$gte": cost}}, {"$inc": {"credits": -cost}}
    )
    if res.modified_count == 1:
        return True, 0
    remaining = (await users_col.find_one({"id": user_id}, {"_id": 0, "credits": 1})) or {}
    return False, remaining.get("credits", 0)


_REJECT_RESULT = json.dumps({
    "status": "rejected", "reason": "insufficient_credits",
    "instruction": "STOP. Do not continue or claim success. Tell the user they are out of credits.",
})


async def _stream_plan(chat, user_msg):
    """Yield ('token', text) for reasoning; ends with ('tools', [tool_calls])."""
    pending = []
    async for ev in chat.stream_message(user_msg):
        if isinstance(ev, TextDelta):
            yield ("token", ev.content)
        elif isinstance(ev, ToolCallReady):
            pending.append(ev.tool_call)
        elif isinstance(ev, StreamDone):
            break
    yield ("tools", pending)


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}\n\n"


async def run_agent(user: dict, prompt: str, context: dict | None) -> AsyncGenerator[str, None]:
    """Yields SSE lines. Deducts credits per queued action; hard-stops on empty balance."""
    from database import users as users_col, prompt_history

    prompt = sanitize_prompt(prompt)
    chat = (LlmChat(api_key=EMERGENT_LLM_KEY, session_id=new_id(), system_message=SYSTEM_PROMPT)
            .with_model(*MODEL_PLANNER)
            .with_tools(TOOLS, tool_choice="auto"))
    user_msg = UserMessage(text=prompt + _build_context_string(context))

    start_credits = int(user.get("credits", 0))
    spent, actions, plan_text, stopped = 0, [], "", False
    yield _sse({"type": "start", "credits": start_credits})

    try:
        while not stopped:
            pending = []
            async for kind, val in _stream_plan(chat, user_msg):
                if kind == "token":
                    plan_text += val
                    yield _sse({"type": "token", "content": val})
                else:
                    pending = val
            if not pending:
                break

            for tc in pending:
                name = tc.name
                args = clamp_hard_limits(name, _parse_args(tc))
                cost = CREDIT_COST.get(name, 1)

                ok, remaining = await _charge_credits(users_col, user["id"], cost)
                if not ok:
                    yield _sse({"type": "hard_stop", "reason": "insufficient_credits",
                                "needed": cost, "remaining": remaining})
                    chat.add_tool_result(tc.id, _REJECT_RESULT)
                    stopped = True
                    break

                cid = await _queue_command(user["id"], None, name, args, cost)
                spent += cost
                action = {"command_id": cid, "tool": name, "args": args, "cost": cost}
                actions.append(action)
                yield _sse({"type": "action", **action})
                chat.add_tool_result(tc.id, json.dumps({"status": "queued", "command_id": cid}))
            user_msg = None
    except Exception as e:
        yield _sse({"type": "error", "message": f"AI planner error: {str(e)}"})
        return

    # Credits already deducted atomically per action above. Record history.
    await prompt_history.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "prompt": prompt,
        "plan_text": plan_text,
        "actions": actions,
        "credits_used": spent,
        "created_at": iso(now_utc()),
    })
    remaining = (await users_col.find_one({"id": user["id"]}, {"_id": 0, "credits": 1})) or {}
    yield _sse({"type": "done", "credits_used": spent,
                "credits_remaining": remaining.get("credits", max(start_credits - spent, 0)),
                "action_count": len(actions)})
