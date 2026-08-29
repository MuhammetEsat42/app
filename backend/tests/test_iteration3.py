"""Iteration 3 backend suite: Stripe payments, Team invites, Plugin code endpoint.

Modules covered:
  - routers/payments.py  : /api/payments/catalog, /checkout, /status/{sid}
  - routers/team.py      : /api/team/invite (POST/PUT/DELETE), /api/team/members
  - server.py            : /api/plugin/code
"""
import uuid

import pytest
import requests

from conftest import BASE_URL, new_session

import os
PASSWORD = os.getenv("TEST_PASSWORD", "Test1234!")
ORIGIN = BASE_URL


def uniq_email(tag="qa"):
    return f"test_{tag}_{uuid.uuid4().hex[:10]}@example.com"


# ---------------- Payments: catalog ----------------
class TestPaymentsCatalog:
    def test_catalog_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/payments/catalog", timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_catalog_shape(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/payments/catalog", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        packs = d["credit_packs"]
        annual = d["annual_plans"]
        assert len(packs) == 4, packs
        assert [p["id"] for p in packs] == ["pack_100", "pack_150", "pack_200", "pack_2000"]
        assert len(annual) == 2
        assert [p["id"] for p in annual] == ["pro_annual", "studio_annual"]

        mega = next(p for p in packs if p["id"] == "pack_2000")
        assert mega["price_usd"] == 200.0
        assert mega["credits"] == 2000
        assert mega["type"] == "credits"

        for p in annual:
            assert p["save_pct"] == 20
            assert p["type"] == "annual"
            assert p["plan"] in ("professional", "studio")
        assert isinstance(d["credits"], int)
        assert d["plan"] == "studio"


# ---------------- Payments: checkout + status ----------------
class TestPaymentsCheckout:
    def test_checkout_unknown_item_400(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/payments/checkout",
                             json={"item_id": "pack_nope", "origin_url": ORIGIN}, timeout=60)
        assert r.status_code == 400, r.text
        assert "Unknown item" in r.text

    def test_checkout_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/payments/checkout",
                            json={"item_id": "pack_2000", "origin_url": ORIGIN}, timeout=60)
        assert r.status_code in (401, 403), r.text

    def test_checkout_pack_2000_and_status_pending(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/payments/checkout",
                             json={"item_id": "pack_2000", "origin_url": ORIGIN}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        url = d["url"]
        sid = d["session_id"]
        assert url.startswith("https://"), url
        assert "stripe" in url, url
        assert sid.startswith("cs_"), sid

        # status before payment -> pending / initiated, not granted
        s = auth_client.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=60)
        assert s.status_code == 200, s.text
        sd = s.json()
        assert sd["session_id"] == sid
        assert sd["payment_status"] == "pending", sd
        assert sd["status"] == "initiated", sd
        assert not sd["granted"]
        assert sd["item_id"] == "pack_2000"
        assert sd["credits"] == 2000

    def test_checkout_annual_plan(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/payments/checkout",
                             json={"item_id": "studio_annual", "origin_url": ORIGIN}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stripe" in d["url"]
        assert d["session_id"].startswith("cs_")

    def test_status_unknown_session_404(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/payments/status/cs_test_doesnotexist", timeout=60)
        assert r.status_code == 404, r.text

    def test_status_no_auth_leaks_no_500(self, api_client):
        # status endpoint currently has NO auth dependency - documents behaviour
        r = api_client.get(f"{BASE_URL}/api/payments/status/cs_test_doesnotexist", timeout=60)
        assert r.status_code != 500, r.text


# ---------------- Plugin code ----------------
class TestPluginCode:
    def test_plugin_code(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/plugin/code", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["filename"].endswith(".lua") or d["filename"].endswith(".luau"), d["filename"]
        code = d["code"]
        assert isinstance(code, str) and len(code) > 500
        assert "create_animation" in code
        assert "X-API-Key" in code
        # polling loop present
        assert "/api/bridge/poll" in code or "bridge/poll" in code
        assert "while" in code and "task.wait" in code


# ---------------- Team ----------------
class TestTeam:
    invite_ids = []

    def test_members_owner_and_can_manage(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/team/members", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["owner"]["role"] == "owner"
        assert d["owner"]["email"] == "test@guiblox.com"
        assert d["can_manage"]
        assert isinstance(d["members"], list)
        assert all("_id" not in m for m in d["members"])

    def test_invite_lifecycle(self, auth_client):
        email = uniq_email("mate")
        r = auth_client.post(f"{BASE_URL}/api/team/invite",
                             json={"email": email, "role": "view"}, timeout=30)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["email"] == email
        assert inv["role"] == "view"
        assert inv["status"] == "pending"
        assert "_id" not in inv
        iid = inv["id"]

        # persisted in members
        m = auth_client.get(f"{BASE_URL}/api/team/members", timeout=30).json()
        row = next((x for x in m["members"] if x["id"] == iid), None)
        assert row is not None and row["role"] == "view"

        # duplicate -> 409
        dup = auth_client.post(f"{BASE_URL}/api/team/invite",
                               json={"email": email, "role": "edit"}, timeout=30)
        assert dup.status_code == 409, dup.text

        # role update -> persists
        up = auth_client.put(f"{BASE_URL}/api/team/invite/{iid}",
                             json={"email": email, "role": "edit"}, timeout=30)
        assert up.status_code == 200, up.text
        m2 = auth_client.get(f"{BASE_URL}/api/team/members", timeout=30).json()
        row2 = next(x for x in m2["members"] if x["id"] == iid)
        assert row2["role"] == "edit"

        # invalid role -> 400
        bad = auth_client.put(f"{BASE_URL}/api/team/invite/{iid}",
                              json={"email": email, "role": "admin"}, timeout=30)
        assert bad.status_code == 400, bad.text

        # delete -> gone
        dl = auth_client.delete(f"{BASE_URL}/api/team/invite/{iid}", timeout=30)
        assert dl.status_code == 200, dl.text
        m3 = auth_client.get(f"{BASE_URL}/api/team/members", timeout=30).json()
        assert all(x["id"] != iid for x in m3["members"])
        # double delete -> 404
        assert auth_client.delete(f"{BASE_URL}/api/team/invite/{iid}", timeout=30).status_code == 404

    def test_invite_invalid_role_400(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/team/invite",
                             json={"email": uniq_email("badrole"), "role": "owner"}, timeout=30)
        assert r.status_code == 400, r.text

    def test_invite_self_400(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/team/invite",
                             json={"email": "test@guiblox.com", "role": "view"}, timeout=30)
        assert r.status_code == 400, r.text
        assert "yourself" in r.text.lower()

    def test_invite_bad_email_422(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/team/invite",
                             json={"email": "not-an-email", "role": "view"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_invite_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/team/invite",
                            json={"email": uniq_email("noauth"), "role": "view"}, timeout=30)
        assert r.status_code in (401, 403), r.text


# ---------------- Free-plan gate ----------------
@pytest.fixture(scope="module")
def free_user_client():
    """Register + verify a fresh FREE-plan user; returns authed session."""
    s = new_session()
    email = uniq_email("free")
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"register failed {r.status_code}: {r.text[:300]}")
    code = r.json().get("verification_code_mock")
    v = s.post(f"{BASE_URL}/api/auth/verify-email", json={"email": email, "code": code}, timeout=30)
    if v.status_code != 200:
        pytest.fail(f"verify failed {v.status_code}: {v.text[:300]}")
    tok = v.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    yield s
    s.close()


class TestFreePlanGate:
    def test_free_user_invite_403(self, free_user_client):
        r = free_user_client.post(f"{BASE_URL}/api/team/invite",
                                  json={"email": uniq_email("x"), "role": "view"}, timeout=30)
        assert r.status_code == 403, r.text
        assert "Professional" in r.text or "Studio" in r.text

    def test_free_user_members_can_manage_false(self, free_user_client):
        r = free_user_client.get(f"{BASE_URL}/api/team/members", timeout=30)
        assert r.status_code == 200, r.text
        assert not r.json()["can_manage"]
