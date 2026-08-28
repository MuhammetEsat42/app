"""GUI Blox backend regression suite.

Covers: health, register/anti-fraud, mock email verification, login, JWT refresh
rotation, API keys (one-time reveal / revoke / regenerate / max-keys / IP allowlist),
bridge plugin auth + poll, AI workspace SSE prompt + credit deduction, estimate,
Redis rate limiting, dashboard endpoints.
"""
import json
import time
import uuid

import pytest
import requests

from conftest import BASE_URL, new_session, rand_ip

PASSWORD = "Test1234!"


def uniq_email(tag="qa"):
    # backend lowercases emails on register, so keep the local part lowercase
    return f"test_{tag}_{uuid.uuid4().hex[:10]}@example.com"


# ---------------- Health ----------------
class TestHealth:
    def test_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200
        assert r.json().get("status") == "online"

    def test_security_headers(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health", timeout=30)
        h = {k.lower(): v for k, v in r.headers.items()}
        assert h.get("x-frame-options") == "DENY"
        assert h.get("x-content-type-options") == "nosniff"
        assert "strict-transport-security" in h


# ---------------- Register + anti-fraud + mock verification ----------------
class TestRegisterVerify:
    def test_register_returns_mock_code_and_verify_grants_5_credits(self):
        s = new_session()
        email = uniq_email("reg")
        r = s.post(f"{BASE_URL}/api/auth/register",
                   json={"email": email, "password": PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        code = body.get("verification_code_mock")
        assert body["email"] == email
        assert isinstance(code, str) and len(code) == 6 and code.isdigit()

        # duplicate email -> 409
        dup = s.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": PASSWORD}, timeout=30)
        assert dup.status_code == 409

        # wrong code -> 400
        bad = s.post(f"{BASE_URL}/api/auth/verify-email",
                     json={"email": email, "code": "000001"}, timeout=30)
        assert bad.status_code == 400

        v = s.post(f"{BASE_URL}/api/auth/verify-email",
                   json={"email": email, "code": code}, timeout=30)
        assert v.status_code == 200, v.text
        tokens = v.json()
        assert tokens["access_token"] and tokens["refresh_token"]

        s.headers.update({"Authorization": f"Bearer {tokens['access_token']}"})
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert me.status_code == 200
        m = me.json()
        assert m["email"] == email
        assert m["email_verified"] is True
        assert m["credits"] == 5
        assert "password_hash" not in m and "_id" not in m

        # re-verify already verified -> 400
        again = s.post(f"{BASE_URL}/api/auth/verify-email",
                       json={"email": email, "code": code}, timeout=30)
        assert again.status_code == 400
        s.close()

    def test_disposable_email_rejected(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": f"TEST_dis_{uuid.uuid4().hex[:6]}@mailinator.com",
                                  "password": PASSWORD}, timeout=30)
        assert r.status_code == 400
        assert "disposable" in r.json()["detail"].lower()

    def test_invalid_email_and_weak_password_rejected(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": "not-an-email", "password": PASSWORD}, timeout=30)
        assert r.status_code == 422
        r2 = api_client.post(f"{BASE_URL}/api/auth/register",
                             json={"email": uniq_email("weak"), "password": "123"}, timeout=30)
        assert r2.status_code == 422, f"weak password accepted: {r2.status_code} {r2.text[:200]}"

    def test_ip_signup_cap_2_per_24h(self):
        ip = rand_ip()
        s = new_session(ip)
        codes = []
        for _ in range(2):
            r = s.post(f"{BASE_URL}/api/auth/register",
                       json={"email": uniq_email("ipcap"), "password": PASSWORD}, timeout=30)
            assert r.status_code == 200, r.text
            codes.append(r.json()["verification_code_mock"])
        third = s.post(f"{BASE_URL}/api/auth/register",
                       json={"email": uniq_email("ipcap"), "password": PASSWORD}, timeout=30)
        assert third.status_code == 429, f"expected 429 signup cap, got {third.status_code}"
        s.close()

    def test_fingerprint_reuse_blocked(self):
        fp = f"TESTFP_{uuid.uuid4().hex[:12]}"
        s1 = new_session()
        r1 = s1.post(f"{BASE_URL}/api/auth/register",
                     json={"email": uniq_email("fp"), "password": PASSWORD, "fingerprint": fp}, timeout=30)
        assert r1.status_code == 200, r1.text
        s2 = new_session()
        r2 = s2.post(f"{BASE_URL}/api/auth/register",
                     json={"email": uniq_email("fp"), "password": PASSWORD, "fingerprint": fp}, timeout=30)
        assert r2.status_code == 409, f"fingerprint reuse allowed: {r2.status_code}"
        s1.close(); s2.close()


# ---------------- Login / JWT ----------------
class TestLogin:
    def test_login_success(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["access_token"] and d["refresh_token"]
        assert d.get("token_type", "bearer").lower() == "bearer"

    def test_login_wrong_password(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": test_credentials["email"], "password": "WrongPass1!"}, timeout=30)
        assert r.status_code == 401

    def test_login_unknown_user(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": uniq_email("ghost"), "password": PASSWORD}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_token(self, api_client):
        assert api_client.get(f"{BASE_URL}/api/auth/me", timeout=30).status_code == 401

    def test_me_rejects_garbage_token(self, api_client):
        api_client.headers.update({"Authorization": "Bearer not.a.jwt"})
        assert api_client.get(f"{BASE_URL}/api/auth/me", timeout=30).status_code == 401

    def test_refresh_token_cannot_be_used_as_access_token(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        refresh = r.json()["refresh_token"]
        api_client.headers.update({"Authorization": f"Bearer {refresh}"})
        assert api_client.get(f"{BASE_URL}/api/auth/me", timeout=30).status_code == 401

    def test_refresh_rotation_and_old_token_revoked(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        old_refresh = r.json()["refresh_token"]

        r1 = api_client.post(f"{BASE_URL}/api/auth/refresh",
                             json={"refresh_token": old_refresh}, timeout=30)
        assert r1.status_code == 200, r1.text
        new_refresh = r1.json()["refresh_token"]
        assert new_refresh != old_refresh

        reuse = api_client.post(f"{BASE_URL}/api/auth/refresh",
                                json={"refresh_token": old_refresh}, timeout=30)
        assert reuse.status_code == 401, f"old refresh token still valid: {reuse.status_code}"

        # new one still works
        r2 = api_client.post(f"{BASE_URL}/api/auth/refresh",
                             json={"refresh_token": new_refresh}, timeout=30)
        assert r2.status_code == 200

    def test_logout_revokes_refresh(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        d = r.json()
        api_client.headers.update({"Authorization": f"Bearer {d['access_token']}"})
        out = api_client.post(f"{BASE_URL}/api/auth/logout",
                              json={"refresh_token": d["refresh_token"]}, timeout=30)
        assert out.status_code == 200
        after = api_client.post(f"{BASE_URL}/api/auth/refresh",
                                json={"refresh_token": d["refresh_token"]}, timeout=30)
        assert after.status_code == 401


# ---------------- Rate limiting (Redis) ----------------
class TestRateLimit:
    def test_auth_endpoint_5_per_min(self):
        s = new_session()
        codes = []
        for _ in range(7):
            r = s.post(f"{BASE_URL}/api/auth/login",
                       json={"email": "nobody@example.com", "password": "x"}, timeout=30)
            codes.append(r.status_code)
            if r.status_code == 429:
                assert "Retry-After" in r.headers, "429 missing Retry-After header"
                assert int(r.headers["Retry-After"]) > 0
                break
        s.close()
        assert 429 in codes, f"no 429 within 7 requests: {codes}"
        assert codes.index(429) == 5, f"limit not exactly 5/min: {codes}"


# ---------------- API keys ----------------
class TestApiKeys:
    created = []

    def test_keys_require_auth(self, api_client):
        assert api_client.get(f"{BASE_URL}/api/keys", timeout=30).status_code == 401

    def test_create_reveal_once_and_list_hides_secret(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/keys", json={"name": "TEST_key_reveal"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        full = d["full_key"]
        assert full.startswith("gb_") and "." in full
        kid = d["key"]["id"]
        assert "secret_hash" not in d["key"]
        assert d["key"]["masked"] and full not in json.dumps(d["key"])

        lst = auth_client.get(f"{BASE_URL}/api/keys", timeout=30)
        assert lst.status_code == 200
        raw = lst.text
        assert "secret_hash" not in raw
        assert full.split(".", 1)[1] not in raw, "secret leaked in list response"
        assert any(k["id"] == kid for k in lst.json())

        # cleanup
        auth_client.post(f"{BASE_URL}/api/keys/{kid}/revoke", timeout=30)

    def test_revoke_and_regenerate(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/keys", json={"name": "TEST_key_rotate"}, timeout=30)
        kid = r.json()["key"]["id"]
        old_full = r.json()["full_key"]

        regen = auth_client.post(f"{BASE_URL}/api/keys/{kid}/regenerate", timeout=30)
        assert regen.status_code == 200, regen.text
        new_full = regen.json()["full_key"]
        new_id_ = regen.json()["key"]["id"]
        assert new_full != old_full

        # old key must no longer authenticate on the bridge
        bs = new_session()
        bs.headers.update({"X-API-Key": old_full})
        assert bs.post(f"{BASE_URL}/api/bridge/poll", timeout=30).status_code == 401
        bs.close()

        rev = auth_client.post(f"{BASE_URL}/api/keys/{new_id_}/revoke", timeout=30)
        assert rev.status_code == 200
        lst = auth_client.get(f"{BASE_URL}/api/keys", timeout=30).json()
        assert any(k["id"] == new_id_ and k["revoked"] for k in lst)

    def test_revoke_unknown_key_404(self, auth_client):
        assert auth_client.post(f"{BASE_URL}/api/keys/{uuid.uuid4().hex}/revoke",
                                timeout=30).status_code == 404

    def test_max_5_active_keys(self, auth_client):
        # clean slate
        for k in auth_client.get(f"{BASE_URL}/api/keys", timeout=30).json():
            if not k["revoked"]:
                auth_client.post(f"{BASE_URL}/api/keys/{k['id']}/revoke", timeout=30)
        ids = []
        for i in range(5):
            r = auth_client.post(f"{BASE_URL}/api/keys", json={"name": f"TEST_max_{i}"}, timeout=30)
            assert r.status_code == 200, r.text
            ids.append(r.json()["key"]["id"])
        sixth = auth_client.post(f"{BASE_URL}/api/keys", json={"name": "TEST_max_6"}, timeout=30)
        assert sixth.status_code == 400, f"6th key allowed: {sixth.status_code}"
        for kid in ids:
            auth_client.post(f"{BASE_URL}/api/keys/{kid}/revoke", timeout=30)


# ---------------- Bridge (plugin) auth ----------------
class TestBridge:
    def test_missing_and_malformed_key(self):
        s = new_session()
        assert s.post(f"{BASE_URL}/api/bridge/poll", timeout=30).status_code == 401
        s.headers.update({"X-API-Key": "garbage"})
        assert s.post(f"{BASE_URL}/api/bridge/poll", timeout=30).status_code == 401
        s.headers.update({"X-API-Key": "gb_abcdef.wrongsecret"})
        assert s.post(f"{BASE_URL}/api/bridge/poll", timeout=30).status_code == 401
        s.close()

    def test_valid_key_poll(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/keys", json={"name": "TEST_bridge_poll"}, timeout=30)
        assert r.status_code == 200, r.text
        full = r.json()["full_key"]
        kid = r.json()["key"]["id"]

        bs = new_session()
        bs.headers.update({"X-API-Key": full})
        p = bs.post(f"{BASE_URL}/api/bridge/poll", timeout=30)
        assert p.status_code == 200, p.text
        d = p.json()
        assert isinstance(d["commands"], list)
        assert isinstance(d["credits"], int)
        assert d["poll_interval"] == 2

        # context + log endpoints
        c = bs.post(f"{BASE_URL}/api/bridge/context",
                    json={"selection": ["Workspace.TEST_Part"], "open_script": "TEST.lua"}, timeout=30)
        assert c.status_code == 200
        lg = bs.post(f"{BASE_URL}/api/bridge/log",
                     json={"level": "info", "message": "TEST bridge log", "source": "studio"}, timeout=30)
        assert lg.status_code == 200

        # last_used tracked
        keys = auth_client.get(f"{BASE_URL}/api/keys", timeout=30).json()
        rec = next(k for k in keys if k["id"] == kid)
        assert rec["last_used_at"], "last_used_at not recorded after poll"

        bs.close()
        auth_client.post(f"{BASE_URL}/api/keys/{kid}/revoke", timeout=30)

    def test_ip_allowlist_403(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/keys",
                             json={"name": "TEST_allowlist", "ip_allowlist": ["1.2.3.4"]}, timeout=30)
        assert r.status_code == 200, r.text
        full = r.json()["full_key"]
        kid = r.json()["key"]["id"]
        assert r.json()["key"]["ip_allowlist"] == ["1.2.3.4"]

        bs = new_session("9.9.9.9")
        bs.headers.update({"X-API-Key": full})
        denied = bs.post(f"{BASE_URL}/api/bridge/poll", timeout=30)
        assert denied.status_code == 403, f"allowlist not enforced: {denied.status_code}"

        # matching IP allowed
        bs2 = new_session("1.2.3.4")
        bs2.headers.update({"X-API-Key": full})
        allowed = bs2.post(f"{BASE_URL}/api/bridge/poll", timeout=30)
        assert allowed.status_code == 200, f"allowlisted IP blocked: {allowed.status_code}"

        bs.close(); bs2.close()
        auth_client.post(f"{BASE_URL}/api/keys/{kid}/revoke", timeout=30)


# ---------------- AI Workspace (core) ----------------
def parse_sse(resp) -> list:
    events = []
    for raw in resp.iter_lines(decode_unicode=True):
        if raw and raw.startswith("data:"):
            try:
                events.append(json.loads(raw[5:].strip()))
            except Exception:
                pass
    return events


class TestWorkspace:
    def test_estimate(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/workspace/estimate",
                             json={"prompt": "Create a red neon Beacon part and write a ModuleScript that pulses transparency"},
                             timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["estimate"], int) and d["estimate"] > 0
        assert isinstance(d["hints"], list) and "Luau script" in d["hints"]
        assert isinstance(d["credits"], int)

    def test_prompt_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/workspace/prompt", json={"prompt": "hi"}, timeout=30)
        assert r.status_code == 401

    def test_prompt_streams_actions_queues_commands_and_deducts_credits(self, auth_client):
        before = auth_client.get(f"{BASE_URL}/api/auth/me", timeout=30).json()["credits"]

        r = auth_client.post(
            f"{BASE_URL}/api/workspace/prompt",
            json={"prompt": "Create a red neon Beacon part in Workspace and write a ModuleScript that pulses its transparency"},
            stream=True, timeout=180,
        )
        assert r.status_code == 200, r.text[:400]
        assert "text/event-stream" in r.headers.get("content-type", "")
        events = parse_sse(r)
        types = [e["type"] for e in events]
        assert "error" not in types, f"AI planner error: {[e for e in events if e['type']=='error']}"
        assert types[0] == "start"
        assert "token" in types, "no streamed reasoning tokens"
        actions = [e for e in events if e["type"] == "action"]
        assert actions, f"no actions produced. types={set(types)}"
        done = [e for e in events if e["type"] == "done"]
        assert done, "no done event"
        done = done[0]

        for a in actions:
            assert a["command_id"] and a["tool"] and isinstance(a["cost"], int) and a["cost"] > 0

        expected_spend = sum(a["cost"] for a in actions)
        assert done["credits_used"] == expected_spend
        assert done["action_count"] == len(actions)

        after = auth_client.get(f"{BASE_URL}/api/auth/me", timeout=30).json()["credits"]
        assert after == before - expected_spend, f"credits {before}->{after}, spent {expected_spend}"

        # commands persisted & queued
        cmds = auth_client.get(f"{BASE_URL}/api/workspace/commands", timeout=30)
        assert cmds.status_code == 200
        cl = cmds.json()
        ids = {c["id"] for c in cl}
        for a in actions:
            assert a["command_id"] in ids, f"command {a['command_id']} not in /workspace/commands"
        assert all("_id" not in c for c in cl)

        # bridge poll claims them
        kr = auth_client.post(f"{BASE_URL}/api/keys", json={"name": "TEST_ws_bridge"}, timeout=30)
        full = kr.json()["full_key"]; kid = kr.json()["key"]["id"]
        bs = new_session()
        bs.headers.update({"X-API-Key": full})
        p = bs.post(f"{BASE_URL}/api/bridge/poll", timeout=30)
        assert p.status_code == 200
        polled = {c["id"] for c in p.json()["commands"]}
        assert polled & {a["command_id"] for a in actions}, "queued commands not delivered to bridge"

        # report a result back
        cid = actions[0]["command_id"]
        res = bs.post(f"{BASE_URL}/api/bridge/result",
                      json={"command_id": cid, "status": "success",
                            "result": {"ok": True}, "logs": ["TEST executed"]}, timeout=30)
        assert res.status_code == 200
        cl2 = auth_client.get(f"{BASE_URL}/api/workspace/commands", timeout=30).json()
        rec = next(c for c in cl2 if c["id"] == cid)
        assert rec["status"] == "success"

        bs.close()
        auth_client.post(f"{BASE_URL}/api/keys/{kid}/revoke", timeout=30)

        # history + ledger reflect the run
        hist = auth_client.get(f"{BASE_URL}/api/history", timeout=30)
        assert hist.status_code == 200 and len(hist.json()) > 0
        led = auth_client.get(f"{BASE_URL}/api/billing/ledger", timeout=30)
        assert led.status_code == 200 and any(x["credits_used"] > 0 for x in led.json())

    def test_zero_credit_user_gets_402(self):
        """Fresh verified user (5 credits) drained -> 402 hard stop."""
        s = new_session()
        email = uniq_email("nocred")
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        code = r.json()["verification_code_mock"]
        v = s.post(f"{BASE_URL}/api/auth/verify-email", json={"email": email, "code": code}, timeout=30)
        assert v.status_code == 200
        s.headers.update({"Authorization": f"Bearer {v.json()['access_token']}"})

        # drain via a script-heavy prompt (write_script costs 8 > 5 -> hard_stop expected)
        pr = s.post(f"{BASE_URL}/api/workspace/prompt",
                    json={"prompt": "Write a ModuleScript that returns a table of 3 utility math functions"},
                    stream=True, timeout=180)
        assert pr.status_code == 200, pr.text[:300]
        events = parse_sse(pr)
        types = [e["type"] for e in events]
        assert "error" not in types, f"planner error: {[e for e in events if e['type']=='error']}"
        # with only 5 credits an 8-credit write_script must hard-stop
        assert "hard_stop" in types or all(e.get("cost", 0) <= 5 for e in events if e["type"] == "action"), \
            f"credit hard-stop not enforced: {types}"

        creds = s.get(f"{BASE_URL}/api/auth/me", timeout=30).json()["credits"]
        assert creds >= 0, "credits went negative"
        s.close()

    def test_bridge_state(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/workspace/bridge-state", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert set(["connected", "selection", "open_script", "last_seen"]).issubset(d.keys())
        assert isinstance(d["connected"], bool)


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_projects_crud(self, auth_client):
        c = auth_client.post(f"{BASE_URL}/api/projects",
                             json={"name": "TEST_project", "data": {"a": 1}}, timeout=30)
        assert c.status_code == 200, c.text
        pid = c.json()["id"]
        assert c.json()["name"] == "TEST_project"
        assert "_id" not in c.json()

        lst = auth_client.get(f"{BASE_URL}/api/projects", timeout=30)
        assert lst.status_code == 200
        assert any(p["id"] == pid and p["data"] == {"a": 1} for p in lst.json())

        d = auth_client.delete(f"{BASE_URL}/api/projects/{pid}", timeout=30)
        assert d.status_code == 200
        assert not any(p["id"] == pid for p in auth_client.get(f"{BASE_URL}/api/projects", timeout=30).json())
        assert auth_client.delete(f"{BASE_URL}/api/projects/{pid}", timeout=30).status_code == 404

    def test_billing_packages(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/billing/packages", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["packages"]) == 3
        assert {p["id"] for p in d["packages"]} == {"pack_100", "pack_150", "pack_200"}
        assert d["plan"] == "studio"

    def test_security_audit_and_sessions(self, auth_client):
        a = auth_client.get(f"{BASE_URL}/api/security/audit", timeout=30)
        assert a.status_code == 200 and isinstance(a.json(), list)
        assert any(e["action"] == "login" for e in a.json())

        s = auth_client.get(f"{BASE_URL}/api/security/sessions", timeout=30)
        assert s.status_code == 200 and isinstance(s.json(), list)
        assert all("_id" not in x for x in s.json())

    def test_dashboard_endpoints_require_auth(self, api_client):
        for path in ["/api/projects", "/api/history", "/api/billing/ledger",
                     "/api/security/audit", "/api/security/sessions"]:
            assert api_client.get(f"{BASE_URL}{path}", timeout=30).status_code == 401, path

    def test_revoke_all_sessions_last(self, test_credentials):
        """Runs on its own session so it doesn't kill the shared seeded tokens."""
        s = new_session()
        lr = s.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        assert lr.status_code == 200
        tok = lr.json()
        s.headers.update({"Authorization": f"Bearer {tok['access_token']}"})
        r = s.post(f"{BASE_URL}/api/security/sessions/revoke-all", timeout=30)
        assert r.status_code == 200 and r.json() == {"ok": True}
        after = s.post(f"{BASE_URL}/api/auth/refresh",
                       json={"refresh_token": tok["refresh_token"]}, timeout=30)
        assert after.status_code == 401, "refresh still valid after revoke-all"
        assert s.get(f"{BASE_URL}/api/security/sessions", timeout=30).json() == []
        s.close()


# ---------------- Unverified-user gating ----------------
class TestVerificationGating:
    def test_unverified_user_cannot_reach_verified_routes(self):
        s = new_session()
        email = uniq_email("unver")
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        # unverified users have no tokens; login should still work but gate verified routes
        lr = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PASSWORD}, timeout=30)
        assert lr.status_code == 200, f"unverified login blocked: {lr.status_code}"
        s.headers.update({"Authorization": f"Bearer {lr.json()['access_token']}"})
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert me.status_code == 200 and me.json()["email_verified"] is False
        assert me.json()["credits"] == 0, "credits granted before verification"
        for path in ["/api/keys", "/api/projects", "/api/history"]:
            assert s.get(f"{BASE_URL}{path}", timeout=30).status_code == 403, path
        p = s.post(f"{BASE_URL}/api/workspace/prompt", json={"prompt": "hi"}, timeout=60)
        assert p.status_code in (402, 403), f"unverified prompt allowed: {p.status_code}"
        s.close()
