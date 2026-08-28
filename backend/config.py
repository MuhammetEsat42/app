"""GUI Blox central config: credit costs, plans, hard-limits, rate limits."""

# ---- Credit costs per executor action (LOCKED pricing) ----
CREDIT_COST = {
    "search_toolbox": 1,
    "create_instance": 1,
    "modify_property": 2,
    "write_script": 8,
    "sculpt_terrain": 12,
    "paint_terrain_material": 8,
    "scatter_assets": 10,
    "insert_toolbox_model": 2,
    "create_animation": 4,
}

FREE_SIGNUP_CREDITS = 5

# ---- Payment catalog (server-authoritative; frontend sends only item_id) ----
# One-time credit packs
CREDIT_PACKS = [
    {"id": "pack_100",  "type": "credits", "price_usd": 10.0,  "credits": 100,  "label": "Starter Pack"},
    {"id": "pack_150",  "type": "credits", "price_usd": 15.0,  "credits": 150,  "label": "Builder Pack"},
    {"id": "pack_200",  "type": "credits", "price_usd": 20.0,  "credits": 200,  "label": "Studio Pack"},
    {"id": "pack_2000", "type": "credits", "price_usd": 200.0, "credits": 2000, "label": "Mega Pack"},
]
# Annual plans (billed yearly; grants plan for 365 days + a large credit bundle)
ANNUAL_PLANS = [
    {"id": "pro_annual",    "type": "annual", "price_usd": 144.0, "credits": 1800, "plan": "professional",
     "label": "Professional — Annual", "monthly_usd": 15, "save_pct": 20},
    {"id": "studio_annual", "type": "annual", "price_usd": 192.0, "credits": 2400, "plan": "studio",
     "label": "Studio — Annual", "monthly_usd": 20, "save_pct": 20},
]
PAYMENT_CATALOG = {it["id"]: it for it in (CREDIT_PACKS + ANNUAL_PLANS)}

# Backwards-compat alias used by older billing UI
CREDIT_PACKAGES = CREDIT_PACKS

PLANS = {
    "free": {"name": "Free", "history_days": 30, "team": False, "ip_allowlist": False, "max_keys": 2},
    "professional": {"name": "Professional", "history_days": 30, "team": True, "ip_allowlist": True, "max_keys": 5},
    "studio": {"name": "Studio", "history_days": None, "team": True, "ip_allowlist": True, "max_keys": 5},
}

# ---- Executor hard-limits (enforced server-side + plugin) ----
HARD_LIMITS = {
    "max_instances_per_action": 100,
    "max_terrain_region": 512,       # 512^3 voxels
    "max_scatter": 500,
}

MAX_ACTIVE_KEYS = 5

# ---- Rate limits (Redis sliding window) ----
RATE_LIMITS = {
    "ip_per_min": (60, 60),
    "ip_per_hour": (500, 3600),
    "auth_per_min": (5, 60),
    "user_prompt_per_min": (30, 60),
    "user_prompt_per_hour": (200, 3600),
    "key_poll_per_min": (60, 60),
}

# ---- Anti-fraud ----
DISPOSABLE_EMAIL_DOMAINS = {
    "tempmail.com", "temp-mail.org", "guerrillamail.com", "guerrillamail.info",
    "mailinator.com", "10minutemail.com", "throwawaymail.com", "yopmail.com",
    "trashmail.com", "getnada.com", "sharklasers.com", "maildrop.cc",
    "fakeinbox.com", "dispostable.com", "mintemail.com", "spam4.me",
}
IP_SIGNUP_LIMIT_24H = 2

# AI models
MODEL_PLANNER = ("anthropic", "claude-sonnet-4-6")
MODEL_TOOLBOX = ("openai", "gpt-5.4-mini")
