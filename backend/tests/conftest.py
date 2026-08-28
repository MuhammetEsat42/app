"""Shared fixtures for GUI Blox backend tests.

NOTE: The backend rate-limits per client IP (5/min on auth paths, 60/min global) and
caps signups at 2 per IP / 24h. `client_ip()` trusts the first X-Forwarded-For entry,
so each test session/request family uses a unique synthetic IP to stay isolated.
"""
import os
import random
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = _base.rstrip("/")


def rand_ip() -> str:
    return f"{random.randint(11, 250)}.{random.randint(1, 250)}.{random.randint(1, 250)}.{random.randint(1, 250)}"


def new_session(ip: str | None = None) -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "X-Forwarded-For": ip or rand_ip()})
    return s


@pytest.fixture
def api_client():
    """Fresh session with a unique synthetic client IP (rate-limit isolation)."""
    s = new_session()
    yield s
    s.close()


@pytest.fixture(scope="session")
def test_credentials():
    path = Path("/app/memory/test_credentials.md")
    if not path.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    content = path.read_text(encoding="utf-8")
    email = re.search(r"(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)", content)
    pwd = re.search(r"(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)", content)
    if not email or not pwd:
        pytest.skip("No credentials parsed from test_credentials.md")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def seeded_tokens(test_credentials):
    s = new_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Seeded user login failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    assert data.get("access_token") and data.get("refresh_token")
    s.close()
    return data


@pytest.fixture
def auth_client(seeded_tokens):
    """Authenticated session for the seeded studio-plan user."""
    s = new_session()
    s.headers.update({"Authorization": f"Bearer {seeded_tokens['access_token']}"})
    yield s
    s.close()
