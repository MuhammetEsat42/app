# GUI Blox — Product Requirements Document

## Original Problem Statement
GUI Blox — Cloud-to-Studio AI Copilot for Roblox (LOCKED v2.2). Web dashboard (primary workspace) + Roblox Studio bridge plugin ("GUI Blox Connect"). Users write prompts on the web; the plugin polls the backend every 2s and executes commands in Studio. Web side shows Monaco Luau preview, Toolbox asset preview, Map/Terrain preview, and a live WebSocket log stream. Full security stack + advanced terrain generation. Design LOCKED: V1 Neon Purple (#0D0D14 bg, #8B5CF6/#A78BFA accents, Inter, 12px radius).

## Architecture
- **Frontend:** React 19 + Tailwind + shadcn/ui + Monaco Editor + FingerprintJS. V1 Neon Purple theme.
- **Backend:** FastAPI (modular routers), WebSocket log stream, SSE AI streaming.
- **DB:** MongoDB (uuid string ids, ISO datetimes).
- **Cache/RateLimit:** Redis (sliding-window), supervisor-managed.
- **AI:** Claude Sonnet 4.6 (tool-calling planner) via Emergent LLM key; GPT 5.4 Mini configured for cheap toolbox tasks.
- **Plugin:** Luau `GUI Blox Connect` at `/app/plugin/GuiBloxConnect.server.lua`.

## User Personas
- Solo Roblox developer (Free): quick instance/UI/script generation.
- Studio/team (Pro/Studio): terrain/map gen, team seats, IP allowlists, audit.

## Core Requirements (static)
Cloud-to-Studio bridge; AI action-plan queueing; credit economy; multi-layer security (Argon2id, JWT rotation, Redis rate limits, anti-fraud); advanced terrain generation; live logs; Fix-with-AI.

## Implemented (2026-08-28) — Phase 1 + AI Workspace demo
- **Auth:** register + MOCK email verification (returns `verification_code_mock`) + login + JWT access(15m)/refresh(7d) with rotation & revocation + logout + /me. Argon2id passwords.
- **Anti-fraud (infra, mostly mocked):** disposable-email blocklist, IP signup cap (2/24h), device fingerprint uniqueness, Turnstile stub, IPQualityScore stub.
- **API keys:** 32-byte secret, Argon2id-hashed, one-time full reveal (`gb_<id>.<secret>`), masked display, per-key IP/CIDR allowlist, revoke/regenerate, last-used IP/timestamp, per-plan caps (Free 2 / Pro-Studio 5), constant-time verify.
- **Rate limiting (Redis):** per-IP 60/min & 500/hr, auth 5/min, per-user prompt 30/min & 200/hr, per-key poll 60/min. 429 + Retry-After.
- **Bridge:** `/api/bridge/poll|result|context|log` (X-API-Key auth), studio connection state, WebSocket `/api/ws/logs` broadcast.
- **AI Workspace:** SSE streaming plan (Claude tool-calling), 8 executor tools (create_instance, modify_property, write_script, search_toolbox, insert_toolbox_model, sculpt_terrain, paint_terrain_material, scatter_assets), server-side hard-limit clamps, atomic per-action credit deduction + hard-stop, prompt-injection sanitization, credit estimate, prompt history (plan-based retention), plan_text persisted.
- **Dashboard pages:** Landing, Auth (login/register/verify), Workspace (prompt + markdown plan stream + Monaco Luau + Toolbox/Terrain preview + live logs + Fix-with-AI + hard-stop banner), Projects, History, Billing (credit packs — Stripe deferred to Phase 5), Team (plan-gated), API Keys, Security (audit + sessions), Settings. Responsive mobile drawer nav.
- **Security headers:** CSP-adjacent (X-Frame-Options, HSTS, nosniff, Referrer/Permissions-Policy).

## MOCKED / Deferred
- Email verification is MOCKED (code in API response, no real send).
- Turnstile / IPQualityScore / real Stripe checkout not wired (infra stubs / UI toast).
- Plugin cannot run in this env; bridge tested via curl with X-API-Key.

## Backlog (prioritized)
- **P0 (Phase 5):** Stripe checkout + webhook (signature verify), dynamic credit top-up.
- **P1:** Real email (Resend) for verification; wire Turnstile + IPQualityScore with keys; behavioral auto-suspend.
- **P1 (Phase 4 polish):** richer Map/Terrain 3D preview; toolbox real search integration.
- **P2:** Team invite flow + View/Edit roles (Phase 6); revoked-key filtering; align credit estimate magnitude; store/show plan_text in History UI.

## Test Credentials
test@guiblox.com / Test1234! (Studio plan, ~149 credits). See /app/memory/test_credentials.md.

## Test Status
- Backend: 36/36 pytest pass (iteration_1). Fixes re-verified via curl + SSE probe.
- Frontend: all 4 reported fixes verified + core workspace regression pass (iteration_2). Credit-deduction regression found & fixed.
