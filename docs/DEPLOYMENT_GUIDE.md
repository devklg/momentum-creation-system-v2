# MCS v2 — Deployment & Verification Guide

Last verified: 2026-06-24. This guide is grounded in the actual repo scripts
(`package.json`, `server/package.json`), the real port registry (`.env`), the
env contract (`server/src/env.ts`), and a live probe of every dependency and
the current `.env`. Where a value below says "verified," it was read from the
running system, not assumed.

This complements `docs/RUN_GUIDE.html`. If they ever disagree, trust this file
for the run/verify steps and reconcile RUN_GUIDE.

---

## 0. Current State Snapshot (verified 2026-06-24)

Dependencies — all UP right now:

| Layer | Endpoint | Status |
|---|---|---|
| Universal Gateway V2 | `http://localhost:2526/api` | UP (proven via Mongo/Neo4j calls; note: `/api/health` returns 404, that path just doesn't exist — the gateway itself answers) |
| MongoDB (`momentum`) | via gateway | UP — 40 collections, `work_queue_leaves` synced |
| Neo4j | via gateway | UP — 67,874 nodes |
| ChromaDB | `localhost:8100` (v2 API) | UP — heartbeat 200 |
| GPU embedding service | `127.0.0.1:8300` | UP — CUDA, RTX 4070 Ti, `gpu_available=true` |

App surfaces — DOWN (not started; this is why you haven't seen it):

| Surface | Port | Status |
|---|---|---|
| Express API (`@momentum/server`) | 7700 | not running |
| `.com` prospect (`@momentum/com`) | 7701 | not running |
| `.team` BA (`@momentum/team`) | 7702 | not running |
| `/admin` (`@momentum/admin`) | 7703 | not running |

`.env` boot-readiness — verified:

- `JWT_SECRET` — set (43 chars). Boot will succeed (this is the only hard-required value).
- `ADMIN_BA_IDS` — `TMBA-FOUNDER-KEVIN`. You can enter `/admin`.
- `GATEWAY_URL` — `http://localhost:2526/api`. Correct.
- `WEBINAR_REGISTER_URL` — set (real Zoom link).
- `ANTHROPIC_API_KEY` — SET (108 chars). ScriptMaker + Ivory LLM drafts are LIVE, not dormant.
- `TELNYX_API_KEY` — SET (58 chars). Telnyx outbound calling is configured — real calls are possible. Treat call flows with care in dev.
- `EMAIL_API_KEY` — EMPTY. Webinar/welcome emails are dormant; SMS fallback is the live path. (Expected — pending `teammagnificent.com` Resend domain verification.)
- `PROSPECT_BASE_URL` — not set → defaults to `http://localhost:7701`, so locally minted `/p/{token}` links resolve to your local `.com`. Good for local. MUST be set to the public domain in production.

Bottom line: nothing is blocking a local run. Start the surfaces and you'll see the app.

---

## 1. Architecture at a Glance

One Express API server, three Vite/React clients, one persistence edge (Gateway
V2) fronting the triple-stack, plus a GPU embedding service.

```
  Browser
    | .com 7701    .team 7702    /admin 7703
    v
  Express API  ──►  Universal Gateway V2 (2526)  ──►  MongoDB + Neo4j + ChromaDB
     7700                    │
                             └──►  GPU embeddings (8300)
```

- Every app data write goes through the triple-stack helper (`tripleStackWrite()`) via the gateway. The gateway must be up before the API is useful.
- `appendAuditEntry()` is the audit primitive; `createInvitation()` mints prospect tokens.

---

## 2. Local Run — Step by Step

### 2.1 Prerequisites (confirm once)

- Node >= 22, pnpm >= 9 (repo pins `pnpm@9.15.0`).
- Dependencies up: Gateway 2526, Chroma 8100, GPU 8300, and Mongo+Neo4j behind the gateway. Per the snapshot above, all are currently up. `pnpm dev*` auto-runs `ensure:gpu` to start the GPU service if it's down.
- A `.env` at the repo root. Yours exists and is boot-ready (see snapshot).

### 2.2 Install (first run or after dependency changes)

```
cd D:\momentum-creation-system-v2
pnpm install
```

### 2.3 Start everything

```
pnpm dev:all
```

This runs `ensure:gpu` then starts all four surfaces in parallel:
7700 API, 7701 `.com`, 7702 `.team`, 7703 `/admin`.

Narrower options if you want fewer processes:

- `pnpm dev` — GPU + `.team` + server only (the two-surface daily loop)
- `pnpm dev:server` / `pnpm dev:com` / `pnpm dev:team` / `pnpm dev:admin` — one surface (each still runs `ensure:gpu` first)

### 2.4 Stop

Ctrl+C in the terminal. If ports stay held by orphaned watchers:

```
Get-Process node | Stop-Process -Force
```

---

## 3. Things to Check — Layer by Layer

Run these top to bottom. A failure at one layer explains failures below it.

### 3.1 Dependencies (before starting the app)

A ready-made probe script is at `.logs\probe-health.ps1`:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .logs\probe-health.ps1
```

Expect: GPU 8300 → 200 healthy; Chroma 8100 v2 → 200 heartbeat. For the
gateway, the truest check is a real tool call (it answers Mongo/Neo4j queries)
rather than `/api/health`, which 404s by design.

### 3.2 API server (7700)

After `pnpm dev:all`, watch the server log for a clean boot (no Zod env error,
no gateway connection error). Then:

```
curl http://localhost:7700/api/health
```

Expect a healthy JSON response. If boot fails immediately, see Troubleshooting.

### 3.3 `.com` prospect surface (7701)

The prospect experience lives at `/p/{token}`. You have existing tokens — open
the newest directly:

```
http://localhost:7701/p/2DATTKR9Q56J
```

Check:

- Invalid token (`http://localhost:7701/p/INVALID`) → graceful rejection, not a crash.
- Valid token → presentation renders; sections load; Dr. Dan video milestone events fire.
- Video completion → Holding Tank placement → dashboard transition works.
- Callback request submits.
- Webinar reservation submits (email will record `emailDeliveryStatus=skipped` because `EMAIL_API_KEY` is empty — that's expected; the Zoom link still comes from `WEBINAR_REGISTER_URL`).
- Prospect re-entry: `http://localhost:7701/p/login` (phone magic link).

To mint a FRESH token instead of reusing one: log into `.team` and create an
invitation (Cockpit / My Invites / Ivory / ScriptMaker). To list existing
tokens, query `momentum.invite_tokens`.

### 3.4 `.team` BA surface (7702)

- `http://localhost:7702` → register / login / welcome.
- Log in as the founder BA (`TMBA-FOUNDER-KEVIN`, `devkev202@gmail.com`). If you don't have/recall a password, register a fresh BA or reset via the welcome flow.
- Verify: Cockpit, Steve Discovery + Success Profile, Michael Training/Daily Success surfaces, My Sponsor, My Invites, CRM, Today's Actions, ScriptMaker, Ivory + Generator, Fast Start, 10-step orientation, replicated preview, profile/settings, leadership, VM campaign page.
- ScriptMaker / Ivory: because `ANTHROPIC_API_KEY` is set, these should produce real LLM drafts. If a draft fails, confirm the key and that the surface isn't falling back to the manual compose form.

### 3.5 `/admin` surface (7703)

- `http://localhost:7703` → admin gate. Entry is gated by `ADMIN_BA_IDS`; yours contains `TMBA-FOUNDER-KEVIN`, so you're authorized. Access codes live in `momentum.access_codes`.
- Verify: dashboard, BA oversight + CRUD, prospect oversight + CRUD, queue oversight, reporting + PDF/CSV export, tenant/master-content editor, orientation roster, broadcast, audit log, VM oversight, agent oversight.
- KNOWN ISSUE: `/admin/live-ops` has `USE_MOCKS = true` (line 49 of `apps/admin/src/routes/live-ops.tsx`). It will show mock data until that flag is flipped and the real `/api/admin/live-ops/*` routes are smoked. Don't mistake mock data for real telemetry.

### 3.6 `.com` compliance pass (before any public exposure)

Walk the prospect surface and confirm NONE of these appear:

- income claims
- placement promises
- AI-prospecting language
- current/total team headcount (the Holding Tank momentum counter is permitted; total org headcount is not)
- THREE branding

---

## 4. End-to-End Smoke Path

One pass that exercises the whole spine:

1. `.com` invalid token → graceful reject.
2. `.com` real token → presentation → video completion → placement → dashboard.
3. `.com` callback request + webinar reservation.
4. `.com` `/p/login` magic-link re-entry.
5. `.team` login → Cockpit.
6. `.team` mint an invitation (Cockpit and via Ivory/ScriptMaker) → open the minted `/p/{token}` in `.com`.
7. `.team` Fast Start progress + Steve/Michael surfaces.
8. `/admin` dashboard, BA/prospect oversight, queue, reports, tenant, broadcast, live-ops (note mocks), agent oversight.

---

## 5. Dormant / Guarded Features (by design)

- Webinar/welcome email: dormant (`EMAIL_API_KEY` empty). SMS fallback is live. To activate: verify `teammagnificent.com` in Resend, set `EMAIL_API_KEY`, send a test reservation, confirm `emailDeliveryStatus` flips skipped→sent.
- VM live delivery: guarded. Requires BOTH `VM_LIVE_DELIVERY_ENABLED=true` AND the campaign doc carrying `adminApprovedForLiveDelivery=true`. Default is dry-run/manual CSV. Leave off until a campaign is explicitly approved.
- Telnyx: key IS set — outbound calling is wired. Be deliberate before triggering any real dial in dev.

---

## 6. First-Run Seed State (verified)

These are already seeded in `momentum`:

- `brand_ambassadors` — 2 founders: `TMBA-FOUNDER-KEVIN` (founder), `TMBA-FOUNDER-PAUL` (co_leader).
- `invite_tokens` — existing tokens present (e.g. `2DATTKR9Q56J`).
- `webinar_events`, `orientation_sessions`, `access_codes`, `ivory_names` — collections exist.

If a surface looks empty, re-run the relevant seeder from the `server` package:

```
pnpm --filter @momentum/server seed:codes
pnpm --filter @momentum/server seed:founders
pnpm --filter @momentum/server seed:webinar-events
pnpm --filter @momentum/server seed:orientation-sessions
pnpm --filter @momentum/server bootstrap:ivory
pnpm --filter @momentum/server setup:founder-access
```

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Server exits at boot with a Zod error | A required env failed validation (most often `JWT_SECRET` < 16 chars) | Set a valid value in `.env`. Yours is currently fine (43 chars). |
| API up but every data action errors | Gateway 2526 unreachable | Confirm the gateway process; run a gateway tool call. The app's persistence edge is the gateway, not a direct DB driver. |
| Embedding/Chroma operations fail | GPU 8300 down or Chroma 8100 down | `pnpm ensure:gpu` (or start the GPU service manually); confirm Chroma heartbeat. Never accept a silent CPU fallback. |
| Port already in use | Orphaned `node` watcher | `Get-Process node | Stop-Process -Force`, then restart. |
| `/admin` rejects you | `ADMIN_BA_IDS` doesn't include your BA ID | Confirm `ADMIN_BA_IDS=TMBA-FOUNDER-KEVIN` in `.env`. |
| `.com` link 404s after deploy | `PROSPECT_BASE_URL` unset/wrong in prod | Set it to the public `.com` domain, no trailing slash. |
| Live-ops shows odd/static numbers | `USE_MOCKS = true` | Expected until the flag is flipped and real routes are smoked. |
| Webinar email never arrives | `EMAIL_API_KEY` empty (dormant) | Activate Resend, or accept SMS-only. |

---

## 8. Production Deployment — Resolve These First

The local picture is fully verified. Production is NOT yet verified end-to-end
in this guide, so this section lists what changes and the open questions to
settle before a real deploy, rather than asserting a topology that hasn't been
confirmed.

Target infra (from prior decisions): Namecheap Quasar VPS (Ubuntu, 4 CPU / 6GB
/ 120GB), domains `teammagnificent.com` and `teammagnificent.team`, subdomains
`book.` and `app.`, admin at `admin.teammagnificent.team`.

What changes vs local:

- `NODE_ENV=production`.
- `PROSPECT_BASE_URL=https://teammagnificent.com` (no trailing slash) — without this, every minted link points at localhost.
- `COM_PUBLIC_URL`, `TEAM_PUBLIC_URL`, `ADMIN_PUBLIC_URL` set to the real domains.
- `CORS_ORIGINS` restricted to the production origins.
- `JWT_COOKIE_DOMAIN=.teammagnificent.team` so the session propagates from `.team` to `admin.teammagnificent.team` (note: `.com` is a separate eTLD+1 — prospect auth there is its own magic-link flow, not the JWT cookie).
- Build: `pnpm build` (runs `-r build` across shared, server, all three clients). Serve the client `dist` bundles via the reverse proxy; run the API with `node dist/index.js` (server `start` script) under a process manager.

Open questions to resolve before deploying (do not assume):

1. WHERE does the triple-stack live in prod? The gateway, MongoDB, Neo4j, ChromaDB, and the GPU embedding service currently run on your local Windows machine. The Quasar VPS has no RTX 4070 Ti. Decide: does the VPS reach back to your machine's gateway, does prod run a separate gateway + DB stack, and what happens to GPU embeddings without the GPU? This is the single biggest unsettled item.
2. Reverse proxy + TLS: nginx/Caddy config mapping the three domains/subdomains to the three client bundles + `/api` to 7700; certificates.
3. Process supervision: pm2/systemd for the API and the VM/broadcast workers.
4. Secrets: production `.env` on the VPS (never committed) — JWT secret, gateway URL, and any activated keys.
5. `D:/server-gateway-mcp-v2` is currently outside version control — bring it into a repo before it becomes a deploy dependency.

Recommendation: get the full local smoke (Sections 3–4) green first, settle
question 1 explicitly, then build the prod runbook from a known-good base.

---

## 9. Command Reference

```
pnpm install                 # install workspace deps
pnpm dev:all                 # GPU + all four surfaces (7700-7703)
pnpm dev                     # GPU + .team + server
pnpm dev:server|com|team|admin
pnpm build                   # build shared, server, all clients
pnpm typecheck               # tsc -r --noEmit across the workspace
pnpm docs                    # rebuild checklist + sync queue from wireframe

# health probes (created for this guide)
powershell -NoProfile -ExecutionPolicy Bypass -File .logs\probe-health.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .logs\probe-env.ps1
```
