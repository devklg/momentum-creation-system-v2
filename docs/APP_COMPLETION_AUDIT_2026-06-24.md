# Momentum Creation System V2 App Completion Audit

Date: 2026-06-24

## Basis

This audit uses the current repo, the source-of-truth wireframe, the Mongo work queue mirror, a fresh API-free graphify structural graph, and local runtime verification.

Evidence checked:

- `docs/project-wireframe.md`
- MongoDB `momentum.work_queue_leaves` through Universal Gateway V2
- Fresh graphify output in `graphify-out/`
- `pnpm typecheck`
- `pnpm build`
- API server boot + `/api/health`
- Gateway V2, ChromaDB, and GPU FastAPI runtime status

The fresh graphify run was API-free. It did not use Anthropic, OpenAI, or any external LLM key. It produced a deterministic code/AST graph only:

- 340 code files
- 3,281 nodes
- 6,098 edges
- 146 communities
- Built from commit `bdc2ec0`

## Executive Summary

The app is no longer a scaffold. It is a broad working monorepo with three clients, one Express API, Universal Gateway V2 persistence, Chroma collection boot guards, BA onboarding, prospect presentation/dashboard flows, invitation generation, Ivory, ScriptMaker, Steve discovery, Michael training/daily-success support, Fast Start, orientation, admin oversight, tenant/master-content, reporting, broadcast, VM campaign infrastructure, and audit controls.

The formal build map says the app is almost complete:

- 154 total leaves
- 152 done
- 1 partial
- 1 pending

The two formal not-done leaves are:

1. Prospect webinar confirmation email is wired through Resend but dormant until `teammagnificent.com` is verified and `EMAIL_API_KEY` is set.
2. `/admin/tenant` still needs the explicit read-only URL-structure panel for token patterns, mint endpoint, and resolution rules.

The code audit found one additional launch-readiness issue not reflected as a pending wireframe leaf:

3. `/admin/live-ops` still has `USE_MOCKS = true`, so the admin UI is showing mock Live Ops data even though the server routes exist.

## Runtime State

Verified working:

- Universal Gateway V2: `http://localhost:2526/api`
- ChromaDB: `localhost:8100`
- GPU FastAPI embedding service: `127.0.0.1:8300`
- API server booted cleanly on `7700`
- `/api/health` returned healthy
- Chroma boot guard reported all 28 registered app collections present
- VM workers started in non-live mode
- Broadcast worker started

Not running by default after the audit:

- `7700` API server was stopped after verification
- `7701`, `7702`, `7703` client dev servers were not started in this pass

Gateway V2 caveats:

- MongoDB, Neo4j, and ChromaDB are connected
- SurrealDB is currently erroring
- Gmail connector is currently erroring
- Gateway V2 does not expose the old V1 `perry`, `quadstack`, or `universal-gateway` meta-tool
- `D:/server-gateway-mcp-v2` is still outside version control

## Graph Findings

The fresh graph confirms the app's core abstractions:

- `gatewayCall()` is the central persistence dependency
- `tripleStackWrite()` is the central app write helper
- `appendAuditEntry()` is the central audit/control primitive
- `findBAByBaId()` is a shared identity lookup dependency
- `createInvitation()` is a key production-line function

This matches the intended architecture: one server, three clients, Gateway V2 as the persistence edge, and audit/triple-stack as the load-bearing substrate.

## Surface Completion

### Foundation

Status: complete, with V2 standardization now documented.

Built:

- pnpm workspace with `apps/com`, `apps/team`, `apps/admin`, `server`, `packages/shared`
- Shared brand, compliance, rules, and types
- Gateway V2 client
- Triple-stack helper
- Chroma collection registry and boot/write guards
- Decision ledger and queue sync scripts
- Fresh API-free graphify output

Remaining:

- Commit the Universal Gateway V2 standardization changes and graph refresh
- Put `D:/server-gateway-mcp-v2` into a repo when Kevin is ready

### Prospect `.com`

Status: functionally complete except dormant email.

Built:

- `/p/:token` resolver
- Presentation/dashboard branching
- Presentation sections
- Leadership section
- Dr. Dan video milestone events
- Holding Tank placement
- Team-wide dashboard
- SSE placement stream
- Callback request flow
- Webinar reservation flow
- Prospect re-entry with phone magic link
- RVM token route

Remaining:

- Activate Resend domain + `EMAIL_API_KEY` so webinar confirmation email sends live
- Browser smoke the full presentation-to-dashboard journey after latest changes

### BA `.team`

Status: functionally complete.

Built:

- Register/login/welcome
- Steve Discovery + Success Profile
- Michael Training Agent / Daily Success Coach surfaces
- Cockpit
- My Sponsor, My Invites, CRM, Today's Actions
- Invitation spine
- ScriptMaker
- Ivory and Generator
- Fast Start modules
- 10-step orientation
- Group orientation reservations
- Replicated preview
- Profile/settings
- Leadership page
- VM campaign page

Remaining:

- Browser smoke the BA daily path: login -> cockpit -> Ivory/ScriptMaker -> invitation -> prospect page
- Confirm any real Telnyx call flow assumptions in a controlled dev/test call

### Admin

Status: nearly complete, with one formal UI leaf and one mock-data flag remaining.

Built:

- Admin auth/gate
- Access codes
- Core dashboard
- BA oversight and CRUD
- Prospect oversight and CRUD
- Queue oversight
- Reporting and PDF/CSV export
- Tenant/master-content editor and inheritance
- Orientation roster/admin creation
- Broadcast
- Audit log/control substrate
- VM oversight
- Agent oversight

Formal remaining leaf:

- Add F.3 read-only URL-structure panel in `/admin/tenant`

Audit finding:

- `apps/admin/src/routes/live-ops.tsx` has `USE_MOCKS = true`
- This must be flipped to real endpoints and browser-smoked before calling Live Ops complete

### VM Campaign Infrastructure

Status: infrastructure present, live delivery intentionally guarded.

Built:

- VM campaign routes and UI
- Import/delivery/webhook workers
- Manual CSV mode
- Provider placeholder mode
- Suppression/compliance tracking
- Ownership correction audit intake
- RVM prospect route

Remaining:

- Keep `VM_LIVE_DELIVERY_ENABLED=false` until a campaign is explicitly approved
- Real provider integration remains future work unless Kevin chooses to activate it

## Formal Remaining Work

### Critical Schema Clarity: Team Magnificent BA ID

The app currently creates the Team Magnificent BA identifier as `brand_ambassadors.baId`.
The generator in `server/src/domain/ba.ts` creates values shaped like `TMBA-YYYYMMDD-XXXXXX`.

This means the identifier exists operationally, but the database schema is not explicit enough. The BA Mongo record does not currently store a plainly named `teamMagnificentId` or `tmBaId` field.

Recommended fix:

- Preserve `baId` for compatibility with existing routes, sessions, graph edges, and related records.
- Add/backfill an explicit alias field such as `tmBaId` or `teamMagnificentId` on `brand_ambassadors`.
- Update schema docs and admin display labels so this is clearly shown as the Team Magnificent ID, not a generic internal id.

### 1. Activate Resend Email

Current state:

- Code exists
- `EMAIL_API_KEY` is empty
- `EMAIL_FROM` is configured
- `WEBINAR_REGISTER_URL` is set
- SMS fallback remains live

Completion steps:

- Verify `teammagnificent.com` in Resend
- Set `EMAIL_API_KEY`
- Send a test webinar reservation
- Confirm `emailDeliveryStatus` changes from skipped to sent
- Confirm the prospect receives the Zoom registration link

### 2. Build `/admin/tenant` F.3 URL-Structure Panel

Current state:

- Wireframe marks this as the only pending leaf
- Some URL information is absorbed into F.1 domain fields

Completion steps:

- Add read-only section to `apps/admin/src/routes/tenant.tsx`
- Display:
  - Prospect URL pattern: `/p/{token}`
  - Mint endpoint: `/api/invitations`
  - Resolve endpoint: `/api/p/:token`
  - Prospect login: `/p/login`
  - Magic-link redeem: `/p/login/r/:linkToken`
  - RVM route: `/rvm/:token`
  - Statement that URL structure changes require deploy
- No mutation controls
- No database write required unless audit tracking is desired for page reads

### 3. Flip Admin Live Ops Off Mocks

Current state:

- Server routes exist at `/api/admin/live-ops/*`
- UI imports real endpoint constants
- UI still sets `USE_MOCKS = true`

Completion steps:

- Set `USE_MOCKS = false`
- Remove or hide mock-active copy
- Start API + admin app
- Login as admin
- Browser smoke:
  - usage strip SSE
  - growth cards
  - holding-tank grid
  - conversion funnels
  - filter behavior
- Verify no console/network failures

## Documentation Reconciliation Needed

The newest source-of-truth is `docs/project-wireframe.md`, plus the synced Mongo queue. Older docs still contain stale language:

- `docs/locked-spec.md` still mentions `/cockpit stub`
- `docs/locked-spec.md` still lists Michael prompt and leadership placement questions as open
- `docs/locked-spec.md` still carries the old completion-transition interrupt note even though later work addressed the presentation/dashboard navigation
- `docs/build-registry.md` has older pending rows for surfaces now marked complete in the wireframe
- `docs/AGENT-BRIEFING.md` still says v1 in its title and contains older path/repo wording

Completion step:

- Reconcile stale docs to match the wireframe and current code, or clearly mark historical sections as superseded.

## Launch-Readiness Checklist

Before calling the app complete for real users:

- Commit Gateway V2 standardization and graph refresh
- Flip Live Ops off mocks and smoke `/admin/live-ops`
- Add Tenant F.3 URL panel
- Activate Resend domain/API key or explicitly accept SMS-only launch
- Run `pnpm typecheck`
- Run `pnpm build`
- Start `pnpm dev:all`
- Browser smoke:
  - `.com` invalid token
  - `.com` real token presentation
  - video completion -> placement -> dashboard
  - callback request
  - webinar reservation
  - prospect `/p/login`
  - `.team` login/register
  - cockpit invitation mint
  - Ivory/ScriptMaker invitation path
  - Fast Start progress
  - Steve/Michael surfaces
  - `/admin` dashboard, BA/prospect oversight, queue, reports, tenant, live ops, broadcast
- Verify no `.com` compliance violations:
  - no income claims
  - no placement promises
  - no AI prospecting language
  - no current team headcount
  - no THREE branding

## Conclusion

The app is approximately complete from a build-map perspective. The remaining work is small but important:

1. Turn on or explicitly defer Resend email.
2. Add the `/admin/tenant` URL-structure panel.
3. Flip `/admin/live-ops` from mocks to real data and browser-smoke it.
4. Reconcile stale docs.
5. Run a full end-to-end browser smoke before launch.

The architecture now aligns with the updated Steve/Michael philosophy and the Universal Gateway V2 standard.
