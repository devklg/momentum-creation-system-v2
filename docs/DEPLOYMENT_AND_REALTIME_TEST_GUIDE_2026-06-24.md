# MCS V2 Deployment and Real-Time Test Guide

Date: 2026-06-24

> **Superseded persistence detail (2026-07-02, ACR-0009):** this dated guide
> predates retirement of the retired HTTP persistence fallback. Current app
> runtime persistence is direct to the dedicated MCS MongoDB, Neo4j, and ChromaDB
> stack. external MCP tooling remains MCP/developer tooling and operator access,
> not the app persistence edge or app memory layer. Any `retired tool-server URL env var` references
> below are historical.

Purpose: give Kevin a practical way to see the app running, understand what it does in real time, and test the workflows that matter before any team rollout.

This guide assumes the repo is:

`D:\momentum-creation-system-v2`

## Current Readiness

The app is buildable and the API boots locally.

Verified before this guide:

- `pnpm typecheck` passes
- `pnpm build` passes
- API boots on `7700`
- `/api/health` returns healthy
- external MCP tooling is healthy on `2526`
- ChromaDB is reachable on `8100`
- GPU FastAPI embedding service is reachable on `8300`
- Chroma boot guard sees all 28 app collections

Do not call this production-ready until these are handled:

- `/admin/live-ops` must be flipped off mocks and browser-tested
- `/admin/tenant` needs the F.3 read-only URL-structure panel
- Resend email is wired but dormant until domain verification and `EMAIL_API_KEY`
- Full browser smoke has not yet been performed by Kevin

## Local Demo Deployment

Use this first. This is how Kevin should see the app before any public deployment.

Run the local demo commands in Windows PowerShell. Use separate PowerShell windows when a command starts a long-running service.

### When To Run What

Use this sequence for a normal local demo:

| Order | When | What to run | Keep it running? |
|---:|---|---|---|
| 1 | Before starting the app, once per Windows session | external MCP tooling startup script | Yes |
| 2 | After infrastructure starts | Health checks and port checks | No |
| 3 | First setup, or after dependency changes | `pnpm install`, `pnpm typecheck`, `pnpm build` | No |
| 4 | First setup, after database reset, or when you need fresh demo data | Seed commands | No |
| 5 | Every time you want to use the app locally | `pnpm dev:all` | Yes |
| 6 | After the app is running | Open the browser URLs and test workflows | App window stays running |

Daily local demo shortcut after setup is complete:

```powershell
cd D:\momentum-creation-system-v2
pnpm dev:all
```

If Codex or Claude is already using external MCP tooling successfully, the external tooling is probably already running. In that case, do not start external MCP tooling again. Just verify the infrastructure ports, then start the app with `pnpm dev:all`.

Only rerun the install/build/seed commands when you changed code, pulled new repo changes, reset data, or need to verify the app before deployment.

### Live Working Checklist

Use this while running the app. Check one status per row and write notes for anything that fails.

| Area | Item to verify | Working | Not working | Notes |
|---|---|---|---|---|
| Infrastructure | external MCP tooling health responds on `2526` | [ ] | [ ] | |
| Infrastructure | MongoDB is listening on `28000` | [ ] | [ ] | |
| Infrastructure | Neo4j Bolt is listening on `7687` | [ ] | [ ] | |
| Infrastructure | ChromaDB is listening on `8100` | [ ] | [ ] | |
| Infrastructure | FastAPI embeddings health responds on `8300` | [ ] | [ ] | |
| App startup | `pnpm install` completes when needed | [ ] | [ ] | |
| App startup | `pnpm typecheck` passes | [ ] | [ ] | |
| App startup | `pnpm build` passes | [ ] | [ ] | |
| App startup | Seed commands complete when needed | [ ] | [ ] | |
| App startup | `pnpm dev:all` starts API, `.com`, `.team`, and `/admin` | [ ] | [ ] | |
| API | `http://localhost:7700/api/health` returns healthy | [ ] | [ ] | |
| Prospect `.com` | Prospect presentation opens with a valid invite token | [ ] | [ ] | |
| Prospect `.com` | Invalid token shows the correct error state | [ ] | [ ] | |
| Prospect `.com` | Presentation progress updates token state | [ ] | [ ] | |
| Prospect `.com` | Position & Momentum Center appears after completion | [ ] | [ ] | |
| Prospect `.com` | Webinar reservation flow works | [ ] | [ ] | |
| Prospect `.com` | Callback request flow works | [ ] | [ ] | |
| BA `.team` | BA login/access flow works | [ ] | [ ] | |
| BA `.team` | Cockpit loads with BA data | [ ] | [ ] | |
| BA `.team` | Invitation creation works | [ ] | [ ] | |
| BA `.team` | Steve discovery/interview path is visible where expected | [ ] | [ ] | |
| BA `.team` | Michael training/daily success path is visible where expected | [ ] | [ ] | |
| Admin | Admin allowlist gate works | [ ] | [ ] | |
| Admin | Admin dashboard loads | [ ] | [ ] | |
| Admin | Live Ops uses real data, not mocks | [ ] | [ ] | Known item to verify/fix |
| Admin | Tenant URL-structure panel exists | [ ] | [ ] | Known missing item |
| Persistence | App writes reach MongoDB through external MCP tooling | [ ] | [ ] | |
| Persistence | App writes reach Neo4j through external MCP tooling | [ ] | [ ] | |
| Persistence | App writes reach ChromaDB through external MCP tooling | [ ] | [ ] | |
| Communications | Resend email is skipped or active as configured | [ ] | [ ] | |
| Communications | Telnyx SMS/calling is skipped or active as configured | [ ] | [ ] | |

### 1. Confirm Infrastructure Is Running

This step is not app startup. This step means: make sure the background services the app depends on are already running.

Required background services:

- external MCP tooling: `http://localhost:2526/api`
- external MCP tooling dashboard: `http://localhost:3102`
- MongoDB: `localhost:28000`
- Neo4j Bolt: `localhost:7687`
- ChromaDB: `http://localhost:8100`
- GPU FastAPI embedding service: `http://127.0.0.1:8300`

The app does not use Mongoose. All MongoDB reads/writes go through the external MCP tooling MongoDB connector.

If all of these services are already running, skip the startup script and go to Step 2.

Only run the V2 startup script if external MCP tooling, MongoDB, Neo4j, ChromaDB, or the embedding service is not already running.

external MCP tooling path:

`D:\external-mcp-tooling`

Startup script outside this repo:

```powershell
D:\external-mcp-tooling\START-ALL-SERVICES-V2.bat
```

Then verify:

```powershell
Invoke-RestMethod http://localhost:2526/health
Invoke-RestMethod http://127.0.0.1:8300/health
```

### 2. Check Ports

Expected ports:

| Port | Service |
|---:|---|
| 2526 | external MCP tooling |
| 28000 | MongoDB |
| 7687 | Neo4j Bolt |
| 7700 | Express API |
| 7701 | `.com` prospect app |
| 7702 | `.team` BA app |
| 7703 | `/admin` app |
| 8100 | ChromaDB |
| 8300 | GPU FastAPI embeddings |

Check:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 2526,28000,7687,7700,7701,7702,7703,8100,8300 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess |
  Sort-Object LocalPort
```

If `7700-7703` are already occupied, stop those app processes before starting this repo.

### 3. Confirm `.env`

Local `.env` should include:

```dotenv
SERVER_PORT=7700
retired tool-server URL env var=http://localhost:2526/api
PROSPECT_BASE_URL=http://localhost:7701
CORS_ORIGINS=http://localhost:7701,http://localhost:7702,http://localhost:7703
JWT_COOKIE_DOMAIN=localhost
ADMIN_BA_IDS=<Kevin TM BA ID>
JWT_SECRET=<long random secret>
```

Production values differ. Do not use production cookie/domain settings for the first local demo unless you are testing actual DNS.

Dormant but optional for local demo:

```dotenv
EMAIL_API_KEY=
ANTHROPIC_API_KEY=
TELNYX_API_KEY=
TELNYX_CONNECTION_ID=
TELNYX_FROM_NUMBER=
```

If these are empty:

- Email sends are skipped
- LLM surfaces use fallback/manual paths
- Telnyx calls/SMS do not send live

### 4. Install and Build

```powershell
cd D:\momentum-creation-system-v2
pnpm install
pnpm typecheck
pnpm build
```

### 5. Seed Required Data

Run from repo root:

```powershell
pnpm --filter @momentum/server seed:founders
pnpm --filter @momentum/server setup:founder-access
pnpm --filter @momentum/server seed:codes
pnpm --filter @momentum/server seed:webinar-events
pnpm --filter @momentum/server seed:orientation-sessions
```

Optional, if testing Ivory collection bootstrap explicitly:

```powershell
pnpm --filter @momentum/server bootstrap:ivory
```

### 6. Start the App

Start all surfaces:

```powershell
pnpm dev:all
```

Or start separately in separate terminals:

Use one PowerShell window per command if starting the services separately.

```powershell
pnpm dev:server
pnpm dev:com
pnpm dev:team
pnpm dev:admin
```

Open:

- Prospect app: `http://localhost:7701`
- BA app: `http://localhost:7702`
- Admin app: `http://localhost:7703`
- API health: `http://localhost:7700/api/health`

## Production Deployment Guide

Production should happen only after the local real-time test pass.

### Production Topology

Recommended production surfaces:

| Domain | App |
|---|---|
| `teammagnificent.com` | `apps/com` |
| `teammagnificent.team` | `apps/team` |
| `admin.teammagnificent.team` | `apps/admin` |
| API private/public route | `server` |

The API should sit behind HTTPS and only accept the three known origins.

### Production Environment

Production `.env` must include:

```dotenv
NODE_ENV=production
SERVER_PORT=7700
retired tool-server URL env var=<production external tooling v2 api url>
PROSPECT_BASE_URL=https://teammagnificent.com
CORS_ORIGINS=https://teammagnificent.com,https://teammagnificent.team,https://admin.teammagnificent.team
JWT_COOKIE_DOMAIN=.teammagnificent.team
JWT_COOKIE_NAME=mcs_session
JWT_SECRET=<production secret>
ADMIN_BA_IDS=<Kevin/approved admin TM BA IDs>
WEBINAR_REGISTER_URL=<Zoom registration url>
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<Resend key after domain verification>
EMAIL_FROM=webinars@teammagnificent.com
TELNYX_API_KEY=<Telnyx key>
TELNYX_PUBLIC_KEY=<Telnyx webhook public key>
TELNYX_CONNECTION_ID=<Telnyx connection id>
TELNYX_FROM_NUMBER=<Telnyx from number>
ANTHROPIC_API_KEY=<optional for live Ivory/ScriptMaker/Michael LLM paths>
```

### Production Build

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Build outputs:

- `apps/com/dist`
- `apps/team/dist`
- `apps/admin/dist`
- `server/dist`
- `packages/shared/dist`

### Production Start

Server:

```powershell
pnpm --filter @momentum/server start
```

Static clients can be served by Caddy, Nginx, Cloudflare Pages, or another static host. Each Vite app must proxy or route `/api` calls to the Express API.

### DNS and TLS

Before public use:

- Point `teammagnificent.com` to the `.com` app
- Point `teammagnificent.team` to the `.team` app
- Point `admin.teammagnificent.team` to the admin app
- Enable HTTPS for all three
- Verify JWT cookie works between `.team` and `admin.teammagnificent.team`
- Verify `.com` prospect session cookie is separate from BA/admin session cookie

### Production Data Seeding

Run once:

```powershell
pnpm --filter @momentum/server seed:founders
pnpm --filter @momentum/server setup:founder-access
pnpm --filter @momentum/server seed:webinar-events
pnpm --filter @momentum/server seed:orientation-sessions
```

Then verify:

- Kevin can log in
- Kevin is admin-authorized
- Founders appear correctly
- Webinar events exist
- Orientation sessions exist or can be created from admin

## Real-Time Test Plan

Use this as the live walkthrough checklist. Each item should be tested with the browser open and dev tools/network tab available.

## Data Store Ownership Correction

external MCP tooling does not contain MongoDB collections, Neo4j nodes, or ChromaDB collections. external MCP tooling is the connector/execution layer. The data itself lives in MongoDB, Neo4j, and ChromaDB.

- MongoDB collections live in MongoDB on `localhost:28000`
- Neo4j graph labels and relationships live in Neo4j on `localhost:7687`
- ChromaDB vector collections live in ChromaDB on `localhost:8100`
- external MCP tooling reaches those stores through the `mongodb`, `neo4j`, and `chromadb` connectors on `localhost:2526`

The printable HTML version includes the detailed MongoDB, ChromaDB, and Neo4j schema inventory.

## Feature Inventory and Functional Status

This is the master feature list for review. "Functional" means the feature exists in code and can operate locally when its required data/env is present. "Conditional" means the app code is present but an external service, env key, or final smoke step is still required.

| Area | Feature | Surface / Route | Status | What to test |
|---|---|---|---|---|
| Infrastructure | external MCP tooling connector access to persistence stores | `server/src/services/persistence/dispatch.ts` | Functional | external MCP tooling health on `2526`, app reads/writes through `/api/execute` |
| Infrastructure | Triple-stack write helper | `server/src/services/tripleStack.ts` | Functional | Writes land in MongoDB, Neo4j, ChromaDB |
| Infrastructure | Chroma collection boot guard | `server/src/services/chromaCollections.ts` | Functional | Server boot logs all 28 collections present |
| Infrastructure | API health | `/api/health` | Functional | `http://localhost:7700/api/health` returns `{ ok: true }` |
| Infrastructure | API-free graphify map | `graphify-out/` | Functional | Open `graphify-out/graph.html` and `GRAPH_TREE.html` |
| Auth | Access-code validation | `.team /register`, `/api/auth/verify-code` | Functional | Enter seeded `TM-XXXX`, sponsor appears |
| Auth | BA registration | `.team /register`, `/api/auth/register` | Functional | Create BA, session cookie set |
| Auth | BA login | `.team /login`, `/api/auth/login` | Functional | Login, refresh, logout |
| Auth | Admin allowlist | `.admin /login`, `/api/admin/*` | Functional | Admin allowed, non-admin forbidden |
| Prospect `.com` | Invalid/expired token handling | `/p/:token` | Functional | `/p/invalid` renders controlled error |
| Prospect `.com` | Replicated presentation | `/p/:token` before completion | Functional | All presentation sections render |
| Prospect `.com` | Dr. Dan video milestone tracking | Section 03, `/api/p/:token/video-event` | Functional | Watch milestones hit API |
| Prospect `.com` | Holding Tank placement | video complete | Functional | Position assigned at completion |
| Prospect `.com` | Prospect dashboard | `/p/:token` after placement | Functional | Position, counters, next actions render |
| Prospect `.com` | Dashboard SSE | `/api/p/:token/stream` | Functional | EventSource connects, heartbeat/live placement updates |
| Prospect `.com` | Callback request | dashboard next move | Functional, Telnyx conditional | Request writes; SMS sends only if Telnyx configured |
| Prospect `.com` | Webinar reservation | dashboard next move | Functional, email conditional | Reservation writes; email sends only if Resend configured |
| Prospect `.com` | Prospect login/re-entry | `/p/login`, `/p/login/r/:linkToken` | Functional, SMS conditional | Phone login returns original token; SMS sends only if Telnyx configured |
| Prospect `.com` | RVM token page | `/rvm/:token` | Functional | RVM token resolves and renders |
| Compliance | `.com` compliance boundary | `.com` app | Functional, must smoke | No income, CV, cycle math, placement promises, AI prospecting, current headcount, THREE branding |
| BA `.team` | Welcome commitment | `/welcome` | Functional | Accept writes commitment |
| BA `.team` | Steve discovery | `/steve/discovery`, `/api/steve` | Functional | Success Profile language, no scoring |
| BA `.team` | Michael schedule/interview | `/michael/schedule`, `/michael/interview` | Functional, Telnyx/worker conditional | States render; live call requires Telnyx |
| BA `.team` | Michael training/daily-success support | cockpit cards + API | Functional | Support card/event card render; no classification language |
| BA `.team` | Cockpit | `/cockpit` | Functional | Sponsor, invites, actions, track record render |
| BA `.team` | CRM notes/reminders/dispositions | cockpit/CRM routes | Functional | Add note, reminder, disposition |
| BA `.team` | Invitation spine | `/invitations`, `/api/invitations` | Functional | Mint `/p/{token}` with phone |
| BA `.team` | ScriptMaker | `/video-library`, `/api/scriptmaker` | Functional, LLM conditional | With key: draft; without key: fallback/manual path |
| BA `.team` | Ivory roster/coaching | `/ivory`, `/api/ivory` | Functional, LLM conditional | Add name, status, prompts; no auto-send |
| BA `.team` | Ivory Momentum | `/ivory/momentum` | Functional, LLM conditional | Momentum suggestions/fallback render |
| BA `.team` | Fast Start training | `/training/fast-start` | Functional | Module progress persists |
| BA `.team` | 10-step orientation page | `/training/10-steps` | Functional | Page renders |
| BA `.team` | Group orientation reservation | cockpit card, `/api/orientation` | Functional | Reserve/cancel seat |
| BA `.team` | Replicated preview | `/preview` | Functional | Preview renders without placement writes |
| BA `.team` | Profile/settings | `/profile`, `/api/profile` | Functional | Phone confirm modal, notification defaults, read-only IDs |
| BA `.team` | Leadership credibility page | `/leadership` | Functional | Page renders with `.team`-safe leadership content |
| BA `.team` | VM campaigns page | `/vm-campaigns` | Functional/dry-run | View campaigns without live delivery |
| Admin | Admin dashboard | `/dashboard` | Functional | Metrics and event stream render |
| Admin | Access-code manager | `/access-codes` | Functional | Create/list codes |
| Admin | BA oversight | `/bas` | Functional | Directory, profile drawer, create/edit/delete/restore |
| Admin | Sponsor override | `/bas` drawer | Functional | Requires reason, audits before/after |
| Admin | Prospect oversight | `/prospects` | Functional | Directory, detail panel, notes, interventions |
| Admin | Queue oversight | `/queue` | Functional | Depth, lookup, visible window, rules |
| Admin | Reporting | `/reports` | Functional | Reports render; CSV/PDF export |
| Admin | PII redaction export | `/reports` | Functional | Redacted/raw export choice audited |
| Admin | Tenant settings/master content | `/tenant` | Functional | Settings/templates validate and save |
| Admin | Tenant URL-structure panel | `/tenant` | Missing | Build F.3 read-only panel |
| Admin | Orientation roster | `/orientation` | Functional | Create sessions, view roster |
| Admin | Broadcast | `/broadcast` | Functional, delivery conditional | Test send; live email/SMS depends on Resend/Telnyx |
| Admin | Audit log | `/audit` | Functional | Filter by actor/action/entity/time |
| Admin | Agent oversight | `/agents` | Functional | Agent event summaries render |
| Admin | VM oversight | `/vm` | Functional/dry-run | Overview, compliance, ownership correction |
| Admin | Live Ops | `/live-ops` | Code present, UI still mocked | Flip `USE_MOCKS=false`, then smoke SSE and real panels |
| Communications | Resend email | `server/src/services/resend.ts` | Conditional/dormant | Requires verified domain + `EMAIL_API_KEY` |
| Communications | Telnyx SMS/calls | `server/src/services/telnyx.ts` | Conditional | Requires Telnyx keys, number, webhook |
| Communications | Anthropic LLM paths | `server/src/services/anthropic.ts` | Conditional | Requires `ANTHROPIC_API_KEY`; fallback paths should work without it |
| VM | Manual CSV/import substrate | VM routes/workers | Functional/dry-run | Import/queue without live delivery |
| VM | Live VM delivery | workers/provider | Guarded/deferred | Keep `VM_LIVE_DELIVERY_ENABLED=false` until approved |
| Docs | Completion audit | `docs/APP_COMPLETION_AUDIT_2026-06-24.md` | Functional artifact | Review remaining work |
| Docs | Deployment/test guide | this file + HTML | Functional artifact | Print and use for walkthrough |

### A. Infrastructure Smoke

Pass criteria: every required service responds before testing the app.

- [ ] `http://localhost:2526/health` returns healthy
- [ ] `http://127.0.0.1:8300/health` returns healthy
- [ ] external MCP tooling `chromadb` connector can list the real ChromaDB collections
- [ ] API `http://localhost:7700/api/health` returns `{ ok: true }`
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes

### B. Public Prospect App Smoke

Pass criteria: public routes render without login and handle errors gracefully.

- [ ] Open `http://localhost:7701`
- [ ] Open `http://localhost:7701/p/invalid`
- [ ] Invalid token shows the intended invalid/expired style, not a raw crash
- [ ] No THREE branding appears on `.com`
- [ ] No income claims, CV math, cycle math, placement promises, or AI prospecting language appears

### C. BA Registration and Login

Pass criteria: a new BA can enter through an access code and create a session.

- [ ] Open `http://localhost:7702/register`
- [ ] Enter a seeded `TM-XXXX` code
- [ ] Sponsor confirmation appears
- [ ] Complete account creation
- [ ] Login at `http://localhost:7702/login`
- [ ] Session persists after refresh
- [ ] Logout/login works

### D. Welcome, Steve, Michael, and Gate

Pass criteria: new BA flow matches the new philosophy: Steve discovers, Michael supports; no scoring/classification.

- [ ] Open `/welcome`
- [ ] Accept welcome commitment
- [ ] Confirm commitment write succeeds
- [ ] Open Steve discovery route
- [ ] Complete or inspect Success Profile flow
- [ ] Confirm no Builder/Emerging/Part-Time/Casual labels appear
- [ ] Open Michael schedule/interview surfaces
- [ ] Confirm Michael language is training/support/daily-success, not evaluation
- [ ] Confirm gated routes behave correctly before/after Michael completion state

### E. BA Cockpit Real-Time Workflow

Pass criteria: BA can see the operating cockpit and take the main action: send invitations.

- [ ] Open `/cockpit`
- [ ] My Sponsor card renders
- [ ] My Invites renders
- [ ] Today's Actions renders
- [ ] Track Record card renders
- [ ] CRM rows expand
- [ ] Add a note to a prospect
- [ ] Set or clear follow-up reminder
- [ ] Set disposition tag
- [ ] Use re-invite/script button

### F. Invitation Spine

Pass criteria: BA can generate a real `/p/{token}` link and the prospect app resolves it.

- [ ] Open `/invitations`
- [ ] Enter prospect name and phone
- [ ] Mint invitation
- [ ] Confirm generated URL uses `PROSPECT_BASE_URL`
- [ ] Open generated `/p/{token}` in `.com`
- [ ] Confirm inviting BA attribution is correct
- [ ] Confirm sponsor is immutable and not editable from request body

### G. ScriptMaker and Ivory

Pass criteria: both front doors lead to invitation creation without violating compliance.

- [ ] Open `/video-library`
- [ ] Select a product/video
- [ ] Draft a message through ScriptMaker
- [ ] Send draft into `/invitations`
- [ ] Mint token
- [ ] Open `/ivory`
- [ ] Add a warm-market name
- [ ] Assign product/angle
- [ ] Generate/queue invitation
- [ ] Confirm no automated sending occurs
- [ ] Confirm no AI lead qualification language appears

If `ANTHROPIC_API_KEY` is empty:

- [ ] Confirm fallback/manual compose path appears and does not crash

### H. Prospect Presentation to Dashboard

Pass criteria: a prospect can watch the presentation, complete video, get placed, and see the dashboard.

- [ ] Open a freshly minted `/p/{token}`
- [ ] Presentation renders all sections
- [ ] Dr. Dan video renders
- [ ] Video milestone calls fire to `/api/p/:token/video-event`
- [ ] At video complete, placement is assigned silently
- [ ] Prospect is not yanked away before choosing dashboard path
- [ ] Dashboard renders position number
- [ ] Behind-you counter renders
- [ ] SSE stream connects
- [ ] Refresh preserves state
- [ ] Return later via same token works

### I. Callback Request

Pass criteria: callback request writes and BA alert path behaves as configured.

- [ ] From dashboard, submit callback request
- [ ] Confirmation appears
- [ ] Mongo/Neo4j/Chroma write succeeds
- [ ] If Telnyx configured, BA receives SMS
- [ ] If Telnyx not configured, app records skipped/fallback state without crashing

### J. Webinar Reservation

Pass criteria: webinar reservation works, with SMS live or email skipped depending on env.

- [ ] Confirm webinar events exist
- [ ] Reserve webinar from prospect dashboard
- [ ] Reservation writes
- [ ] BA notification SMS sends if Telnyx configured
- [ ] Prospect email sends if Resend configured
- [ ] If Resend is not configured, `emailDeliveryStatus='skipped'`
- [ ] Zoom registration URL is present if configured

### K. Prospect Re-Entry

Pass criteria: prospect can regain access without changing sponsor/token identity.

- [ ] Open `/p/login`
- [ ] Enter phone for a prospect account
- [ ] Magic link is generated
- [ ] Redeem `/p/login/r/:linkToken`
- [ ] Redirect returns to original `/p/{token}`
- [ ] Reusing same magic link fails
- [ ] Expired magic link fails
- [ ] Sponsor remains original inviting BA

### L. Training and Orientation

Pass criteria: BA training flow works and progress persists.

- [ ] Open `/training/fast-start`
- [ ] Complete module 1
- [ ] Confirm progress write
- [ ] Complete remaining modules as allowed
- [ ] Open `/training/10-steps`
- [ ] Open cockpit orientation card
- [ ] Reserve orientation session
- [ ] Cancel orientation session
- [ ] Admin roster reflects reservation/cancel

### M. Profile and Settings

Pass criteria: BA can update safe profile fields with audit where required.

- [ ] Open `/profile`
- [ ] Update phone
- [ ] Confirm modal appears before phone save
- [ ] Update notification preferences
- [ ] Confirm operational notifications default on
- [ ] Confirm promotional/digest defaults off unless opted in
- [ ] Confirm sponsor/THREE BA ID/TM BA ID are read-only

### N. Admin Login and Gate

Pass criteria: admin is Kevin-only.

- [ ] Open `http://localhost:7703/login`
- [ ] Login as Kevin/admin BA
- [ ] Dashboard renders
- [ ] Try non-admin BA
- [ ] Non-admin receives hard forbidden state
- [ ] Admin request is audit logged

### O. Admin Core Surfaces

Pass criteria: each admin surface loads and reads real data.

- [ ] `/dashboard`
- [ ] `/access-codes`
- [ ] `/bas`
- [ ] `/prospects`
- [ ] `/queue`
- [ ] `/reports`
- [ ] `/tenant`
- [ ] `/orientation`
- [ ] `/vm`
- [ ] `/agents`
- [ ] `/broadcast`
- [ ] `/audit`

### P. Admin Mutation Tests

Pass criteria: sensitive changes require reason, audit, and before/after state.

- [ ] Create access code
- [ ] Create BA mirror record
- [ ] Edit BA field
- [ ] Soft-delete BA
- [ ] Restore BA
- [ ] Create prospect from admin
- [ ] Edit prospect field
- [ ] Soft-delete prospect
- [ ] Restore prospect
- [ ] Sponsor override requires reason
- [ ] Queue rule change requires reason
- [ ] Master content save validates compliance
- [ ] Master content violation blocks save

### Q. Admin Live Ops

Pass criteria: this must use real endpoints, not mocks.

Before testing, change:

`apps/admin/src/routes/live-ops.tsx`

from:

```ts
const USE_MOCKS = true;
```

to:

```ts
const USE_MOCKS = false;
```

Then test:

- [ ] Usage strip connects by SSE
- [ ] Active admin sessions increments
- [ ] Active dashboard viewers increments when a prospect dashboard is open
- [ ] Events/min updates after placement
- [ ] external MCP tooling p50/p95 latency displays
- [ ] Growth cards load real counts
- [ ] Holding-tank grid loads real placements
- [ ] Funnel toggles between prospect and BA activation
- [ ] Filter by BA works
- [ ] No "Mocks active" copy appears

### R. Broadcast

Pass criteria: Kevin can preview/test before any audience send.

- [ ] Open `/broadcast`
- [ ] Select audience
- [ ] Confirm recipient count
- [ ] Compose message
- [ ] Preview interpolation
- [ ] Send test to Kevin only
- [ ] Confirm audit row
- [ ] Confirm STOP/exclusion behavior
- [ ] Full send remains gated by Kevin confirmation

### S. VM Campaigns

Pass criteria: VM infrastructure is visible but live delivery remains guarded.

- [ ] Open `/vm`
- [ ] Overview cards load
- [ ] Batch health loads
- [ ] Compliance/suppression summary loads
- [ ] Ownership correction form writes audit entry
- [ ] Confirm `VM_LIVE_DELIVERY_ENABLED=false` for demo
- [ ] Confirm no accidental live provider sends

### T. Compliance Sweep

Pass criteria: no prospect-facing compliance violations.

On `.com`, confirm absence of:

- [ ] Income claims
- [ ] Earnings projections
- [ ] Commission figures
- [ ] CV amounts
- [ ] Cycle math
- [ ] Placement promises
- [ ] Queue position equals binary leg language
- [ ] AI prospecting language
- [ ] Current team headcount
- [ ] THREE logo/name/branding

Confirm presence of:

- [ ] Team Magnificent branding
- [ ] PMV framing only: People -> Momentum -> Volume -> Checks
- [ ] Clear BA attribution
- [ ] No automated prospecting or AI calling

## Real-Time Demo Script for Kevin

Use this order for the first live review.

1. Open `.team` as Kevin/BA.
2. Open cockpit and explain the operating center.
3. Use Ivory or ScriptMaker to create an invitation.
4. Mint a real `/p/{token}`.
5. Open the token in `.com` as the prospect.
6. Watch the presentation flow.
7. Trigger video completion.
8. Show the dashboard and position/momentum center.
9. Submit callback request.
10. Reserve webinar.
11. Return to cockpit and show the prospect activity.
12. Open `/admin`.
13. Show dashboard, BA/prospect oversight, queue, reports.
14. Open Live Ops after mocks are disabled.
15. Show audit entries for the actions just performed.

## Acceptance Criteria for "Complete"

The app can be called complete when:

- [ ] Local `pnpm dev:all` runs cleanly
- [ ] Full browser walkthrough above passes
- [ ] `/admin/live-ops` uses real endpoints
- [ ] `/admin/tenant` F.3 panel exists
- [ ] Resend is either live or formally deferred as SMS-only launch
- [ ] Kevin has personally watched the real-time prospect/BA/admin loop
- [ ] No critical console errors
- [ ] No failed API calls in the main workflows
- [ ] No compliance violations on `.com`
- [ ] Production env values are set
- [ ] DNS/TLS are verified

## Known Deferred Items

These do not block local review:

- Resend live email until domain verification
- Telnyx live calls/SMS until keys/webhook are confirmed
- Real provider integration for VM acquisition beyond manual/placeholder mode
- Putting `external MCP tooling repo` into its own repo
- Reconciling stale historical docs after the app review
