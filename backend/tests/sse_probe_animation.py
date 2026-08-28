"""Probe the workspace SSE prompt endpoint for the create_animation tool (iteration 3)."""
import json
import os
import sys

import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
PROMPT = sys.argv[1] if len(sys.argv) > 1 else "Animate the selected part to spin forever and fade out"

s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"email": "test@guiblox.com", "password": "Test1234!"})
print("login", r.status_code)
tok = r.json()["access_token"]
h = {"Authorization": f"Bearer {tok}"}
print("credits before:", s.get(f"{BASE}/api/auth/me", headers=h).json().get("credits"))

events = []
with s.post(f"{BASE}/api/workspace/prompt", json={"prompt": PROMPT}, headers=h, stream=True, timeout=300) as resp:
    print("prompt status", resp.status_code)
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        try:
            obj = json.loads(line[5:].strip())
        except Exception:
            continue
        if obj.get("type") == "token":
            continue
        events.append(obj)
        print("EVENT", obj.get("type"), json.dumps(obj)[:500])

print("credits after:", s.get(f"{BASE}/api/auth/me", headers=h).json().get("credits"))
tools = [e.get("action", {}).get("type") or e.get("tool") for e in events if e.get("type") == "action"]
print("ACTION TOOLS:", tools)
print("HAS ERROR EVENT:", any(e.get("type") == "error" for e in events))

# verify queued commands via bridge/pending style endpoint if available
q = s.get(f"{BASE}/api/workspace/commands", headers=h)
print("commands endpoint", q.status_code, q.text[:800])
