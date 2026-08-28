"""Probe the workspace SSE prompt endpoint and dump raw events (RCA helper)."""
import json
import os

import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")

s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"email": "test@guiblox.com", "password": "Test1234!"})
print("login", r.status_code)
tok = r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")
print("token?", bool(tok), list(r.json().keys()))

h = {"Authorization": f"Bearer {tok}"}
with s.post(f"{BASE}/api/workspace/prompt", json={"prompt": "Create a red neon Beacon part with a pulsing transparency ModuleScript"}, headers=h, stream=True, timeout=180) as resp:
    print("prompt status", resp.status_code)
    for line in resp.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("data:"):
            payload = line[5:].strip()
            try:
                obj = json.loads(payload)
            except Exception:
                print("RAW", payload[:200])
                continue
            t = obj.get("type")
            if t == "token":
                continue
            print("EVENT", t, json.dumps(obj)[:400])
        else:
            print("LINE", line[:200])

me = s.get(f"{BASE}/api/auth/me", headers=h).json()
print("credits after:", me.get("credits"))
