"""Iteration 5 — verify REAL email verification switch (Resend) + auth regression.

Scope: register contract (no mock code, email_sent key), anti-fraud (disposable/duplicate),
verify-email negative path, login + /me regression.
"""
import uuid

import pytest

from conftest import BASE_URL, new_session, rand_ip


def _payload(email):
    return {
        "email": email,
        "password": "Test1234!",
        "turnstile_token": "mock-token",
        "fingerprint": f"fp_{uuid.uuid4().hex[:16]}",
    }


@pytest.fixture(scope="module")
def registered():
    """Register one fresh user (unique IP so signup cap not hit)."""
    email = f"TEST_it5_{uuid.uuid4().hex[:10]}@example.com"
    s = new_session(rand_ip())
    r = s.post(f"{BASE_URL}/api/auth/register", json=_payload(email), timeout=60)
    return {"email": email, "status": r.status_code, "body": r.json() if r.text else {}, "session": s}


# --- register contract ---
class TestRegisterContract:
    def test_register_returns_200(self, registered):
        assert registered["status"] == 200, registered["body"]

    def test_no_mock_code_field(self, registered):
        body = registered["body"]
        assert "verification_code_mock" not in body, f"mock code leaked: {body}"
        # no 6-digit code anywhere in the response
        assert not any(isinstance(v, str) and v.isdigit() and len(v) == 6 for v in body.values()), body

    def test_email_sent_key_present(self, registered):
        body = registered["body"]
        assert "email_sent" in body
        assert isinstance(body["email_sent"], bool)
        assert body["email"] == registered["email"].lower()
        assert "message" in body


# --- anti-fraud ---
class TestAntiFraud:
    def test_disposable_domain_rejected(self):
        s = new_session(rand_ip())
        r = s.post(f"{BASE_URL}/api/auth/register",
                   json=_payload(f"TEST_it5_{uuid.uuid4().hex[:8]}@mailinator.com"), timeout=60)
        assert r.status_code == 400, r.text[:300]
        assert "isposable" in r.json().get("detail", "")

    def test_duplicate_email_conflict(self, registered):
        s = new_session(rand_ip())
        r = s.post(f"{BASE_URL}/api/auth/register", json=_payload(registered["email"]), timeout=60)
        assert r.status_code == 409, r.text[:300]


# --- verify-email negative path ---
class TestVerifyEmailNegative:
    def test_wrong_code_400(self, registered):
        s = new_session(rand_ip())
        r = s.post(f"{BASE_URL}/api/auth/verify-email",
                   json={"email": registered["email"], "code": "000001"}, timeout=30)
        assert r.status_code == 400, r.text[:300]
        assert "Invalid verification code" in r.json().get("detail", "")

    def test_unknown_email_404(self):
        s = new_session(rand_ip())
        r = s.post(f"{BASE_URL}/api/auth/verify-email",
                   json={"email": f"TEST_nobody_{uuid.uuid4().hex[:8]}@example.com", "code": "123456"},
                   timeout=30)
        assert r.status_code == 404, r.text[:300]


# --- login / me regression ---
class TestLoginRegression:
    def test_login_and_me(self, test_credentials):
        s = new_session(rand_ip())
        r = s.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["access_token"] and data["refresh_token"]
        assert isinstance(data["access_token"], str)

        s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert me.status_code == 200, me.text[:300]
        mj = me.json()
        assert mj["email"] == test_credentials["email"]
        assert mj["email_verified"] is True
        assert "_id" not in mj

    def test_login_wrong_password_401(self, test_credentials):
        s = new_session(rand_ip())
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": test_credentials["email"], "password": "wrong-pass-1!"}, timeout=30)
        assert r.status_code == 401, r.text[:300]


def test_cleanup_registered_user(registered):
    """Remove the test-created user directly from Mongo (no admin delete endpoint)."""
    import asyncio
    import os
    import sys
    sys.path.insert(0, "/app/backend")
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")

    async def _del():
        c = AsyncIOMotorClient(mongo_url)
        res = await c[db_name].users.delete_many({"email": registered["email"].lower()})
        c.close()
        return res.deleted_count

    assert asyncio.run(_del()) >= 1
