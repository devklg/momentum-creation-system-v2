# MCS v2 App State Audit — Codex

Date: 2026-07-07
Branch: `main`
Commit: `fc365acb98fabc12b5d49ada6a301ff7b53b42d7`

## Scope

This audit checks the current repo state after the `feat/launch-rail` work was fast-forwarded to `main`.
It covers app completion, remaining work, stale documentation risks, runtime/build readiness, and the
Knowledge Base / context-layer state that now matters to Steve, Michael, Ivory, and future agents.

## Sources Read

- `FOUNDATION_v1.0_FREEZE.md`
- `constitution/MOMENTUM_CONSTITUTION.md`
- `constitution/MOMENTUM_DECISION_FRAMEWORK.md`
- `constitution/MOMENTUM_ACR_SYSTEM.md`
- `engineering/agents/REPOSITORY_ANALYSIS_AGENT.md`
- `engineering/agents/DOCUMENTATION_ALIGNMENT_AGENT.md`
- `docs/READ-ME-FIRST.md`
- `docs/AGENT-BRIEFING.md`
- `docs/project-wireframe.md`
- `docs/build-registry.md`
- `docs/locked-spec.md`
- `docs/APP_COMPLETION_AUDIT_2026-06-24.md`
- `docs/DEPLOYMENT_AND_REALTIME_TEST_GUIDE_2026-06-24.md`
- `docs/admin-cde-integration-followups.md`
- `docs/app-data-model-contract.md`
- `graphify-out/GRAPH_REPORT.md`
- Current code under `apps/`, `server/`, and `packages/shared`
- Local Mongo `momentum` queue/ledger collections through direct app persistence

## Git State

- Worktree: clean
- Current branch: `main`
- `origin/main`: same commit
- Recent commits:
  - `fc365ac` — Steve/Michael context work
  - `c0c6bf1` — THREE knowledge corpus ingestion
  - `9b54ae9` — launch rail replaces Launch Center hero

## Executive State

The app is no longer a scaffold. It is a broad working monorepo with:

- Prospect `.com` presentation, dashboard, token lifecycle, callback, webinar reservation, and re-entry flows.
- BA `.team` register/login/welcome/cockpit, invitation spine, ScriptMaker, Ivory, Fast Start, Steve/Michael context surfaces, profile, leadership, and VM campaign surfaces.
- Admin auth, access codes, BA/prospect oversight, queue, audit, reporting/export, tenant/master-content, live ops route family, broadcast, knowledge intake, and VM oversight.
- Knowledge Base schema, admin upload route, source/chunk records, Neo4j chunk links, Chroma retrieval, and seeded THREE / Team Magnificent strategic knowledge.

Formal wireframe status from `docs/project-wireframe.md`:

- Done leaves: 141
- Partial leaves: 1
- Pending leaves: 1

The two formal not-done leaves are:

1. Prospect confirmation email is wired but dormant until Resend/domain configuration is live.
2. `/admin/tenant` still needs the F.3 read-only URL-structure panel.

The current code also confirms one additional launch-readiness issue:

3. `/admin/live-ops` still has `USE_MOCKS = true`, so the admin Live Ops UI is not yet reading the real route data.

## Verification Results

Root `pnpm typecheck` and `pnpm build` did not execute because the current pnpm wrapper stops on the local approve-builds policy:

- Ignored build scripts: `argon2`, `esbuild`
- Required action outside this audit: approve or configure pnpm build-script policy.

Direct workspace verification passed:

- Shared TypeScript: pass
- Server TypeScript: pass
- `.com` TypeScript: pass
- `.team` TypeScript: pass
- Admin TypeScript: pass
- Shared build: pass
- Server build: pass
- `.com` Vite build: pass
- `.team` Vite build: pass, with normal >500 kB chunk warning
- Admin Vite build: pass
- Targeted server tests: 5 files, 39 tests passed

No tracked files were dirtied by verification.

## Completion By Surface

### Foundation

Status: largely complete, with operational mirror drift.

Built:

- pnpm workspace with `apps/com`, `apps/team`, `apps/admin`, `server`, `packages/shared`.
- Direct app persistence adapters and `tripleStackWrite`.
- Shared brand/compliance/rules/runtime types.
- Chroma collection boot and query support.
- Knowledge Base schema and store-backed source/chunk pipeline.
- Context packet/runtime schemas and Steve/Michael context foundation.

Needs work:

- Local `momentum.work_queue_leaves`, `momentum.decisions`, `momentum.agent_status`, and `momentum.work_queue` all returned zero rows. The docs say the queue/ledger are operational currency and mirror, but this local DB is not seeded.
- Graphify output is stale: built at commit `bdc2ec0`, while current HEAD is `fc365ac`.
- Root `TASK.md` is stale and names branch `feat/fast-start-training`, not current `main`.

### Prospect `.com`

Status: functionally complete except live email and browser smoke.

Built:

- `/p/:token` presentation/dashboard resolver.
- Presentation sections including leadership section.
- Dr. Dan video milestone events.
- Holding-tank placement and Position & Momentum Center.
- SSE placement stream.
- Callback request flow.
- Webinar reservation.
- Prospect phone magic-link re-entry.
- RVM token route.

Needs work:

- Activate Resend for prospect webinar confirmation email, or explicitly accept SMS-only launch.
- Full browser smoke of real token → video event → placement → dashboard → callback/webinar.
- Compliance browser pass before launch: no income claims, placement promises, AI-prospecting language, current team count, or THREE branding on `.com`.

### BA `.team`

Status: functionally complete from the build map.

Built:

- Register/login/welcome.
- Steve Discovery / Success Interview route and runtime foundation.
- Michael training/daily-success runtime card and route boundary.
- Cockpit, My Sponsor, My Invites, CRM, Today's Actions.
- Invitation spine, ScriptMaker, Ivory, generator.
- Fast Start 5 modules and progress.
- 10-step orientation and orientation reservations.
- Replicated preview.
- Profile/settings.
- Leadership page.
- VM campaign page.

Needs work:

- Browser smoke the BA daily path: login → cockpit → Ivory/ScriptMaker → invitation mint → prospect page.
- Controlled Telnyx/voice-path test for Steve/Michael assumptions.
- Context Manager live flags are off in `.env.example`: `MCS_CONTEXT_MANAGER_LIVE_ENABLED=false`, `STEVE_CONTEXT_MANAGER_LIVE_ENABLED=false`. This is safe, but means live Context Manager behavior must be intentionally enabled/tested before claiming agent-context production behavior.

### Admin

Status: nearly complete, but two real launch blockers remain.

Built:

- Admin gate.
- Access codes.
- Core dashboard.
- BA/prospect oversight and CRUD.
- Queue oversight.
- Reporting, PDFs, CSV export, redaction.
- Tenant/master-content editor and inheritance.
- Orientation admin.
- Broadcast.
- Audit/control substrate.
- Knowledge Base intake.
- VM oversight.
- Agent oversight.

Needs work:

- Add `/admin/tenant` F.3 URL-structure read-only panel.
- Flip `/admin/live-ops` from `USE_MOCKS = true` to real data and browser-test all Live Ops panels.
- Resolve or explicitly carry known deferred admin follow-ups:
  - Visible-window setting not wired to `.com` SSE/client.
  - Flush-week setting not wired into token mint.
  - Click IP/referrer not captured.
  - System-detected leader tag dormant until THREE qualification feed exists.
  - Suspended-status write path missing.
ase / Context Layer

### Knowledge B
Status: real and working, with a seed corpus in place.

Built:

- `knowledge_base.schema.v1`
- Mongo: `mcs_knowledge_sources`, `mcs_knowledge_chunks`
- Neo4j: `KnowledgeSource` - `HAS_CHUNK` -> `KnowledgeChunk`
- Chroma: `mcs_knowledge_chunks` retrieval
- Admin text/file upload route
- Store-backed approved knowledge provider
- THREE corpus seeder
- MCS strategic foundation ingested

Verified before this audit:

- 38 THREE source documents, 471 active chunks.
- MCS Strategic Foundation source with 12 chunks.
- Semantic search returns THREE product science and MCS strategic foundation material.

Needs work:

- Decide whether official THREE documents should get a first-class `sourceType` instead of the current generic `owned_text` plus provenance fields.
- Add a simple admin list/search/readback UI for ingested sources if Kevin wants to manage KB content visually.
- Ensure the local decision/work queue mirror is restored so the KB/context layer can become the operational context compiler, not only a source store.

### VM Campaign Infrastructure

Status: infrastructure present, live delivery intentionally guarded.

Built:

- VM routes/UI.
- Import/delivery/webhook workers.
- Manual CSV mode.
- Provider placeholder mode.
- Suppression/compliance concepts.
- RVM route.

Needs work:

- `VM_LIVE_DELIVERY_ENABLED=false` remains correct until Kevin explicitly approves live campaign delivery.
- `acquisition_provider_placeholder` is still a provider mode.
- `vmNotificationHooks.ts` returns `stubbed` statuses.
- This is not a blocker for core MCS launch unless VM campaigns are part of the launch definition.

## Stale / Drift Findings

1. `TASK.md` is stale and belongs to `feat/fast-start-training`.
2. `docs/build-registry.md` is stale relative to the wireframe; it still lists shipped surfaces as pending.
3. `docs/AGENT-BRIEFING.md` still says v1 and contains older repo/path/tooling language.
4. `docs/DEPLOYMENT_AND_REALTIME_TEST_GUIDE_2026-06-24.md` still contains old external tooling wording in some checklist rows even though later notes say app persistence is direct.
5. `docs/project-wireframe.md` is currently the best build-map artifact, but its Mongo mirror is empty locally.
6. `graphify-out/GRAPH_REPORT.md` is code-only and stale.

## Launch Readiness Judgment

Build-map completion: approximately 98–99%.

Launch readiness: not yet.

Reasons:

- Admin Live Ops still displays mocks.
- Tenant F.3 panel is still missing.
- Resend email is dormant unless explicitly deferred.
- Operational queue/decision ledger mirror is empty locally.
- Full end-to-end browser smoke has not been run in this audit.
- Root pnpm commands are blocked by approve-builds policy, even though direct workspace builds pass.

## Recommended Next Sequence

1. Fix `/admin/live-ops` mock mode and browser-smoke real Live Ops.
2. Add `/admin/tenant` F.3 read-only URL-structure panel.
3. Decide Resend: activate now or mark SMS-only launch as approved.
4. Regenerate and seed `momentum.work_queue_leaves` / decision ledger mirrors from current wireframe/seed scripts.
5. Reconcile stale root `TASK.md`, `docs/build-registry.md`, and `docs/AGENT-BRIEFING.md`.
6. Refresh graphify at current HEAD.
7. Run a full browser smoke with dev servers:
   - `.com` invalid/expired/enrolled/valid token flows.
   - video completion to dashboard.
   - callback and webinar.
   - prospect login/re-entry.
   - `.team` login/cockpit/invite/Ivory/ScriptMaker/Fast Start/Steve/Michael.
   - admin dashboard, BA/prospect, queue, reports, tenant, live ops, broadcast, knowledge.
8. Approve pnpm build scripts or document the local workaround, then run root `pnpm typecheck` and `pnpm build`.

## Bottom Line

The product is very close from a build-surface perspective. The remaining work is not another giant feature tranche; it is a launch-hardening pass: remove mocks, add the one missing admin panel, make a decision on email, repair the operational mirror data, reconcile stale docs, and perform full browser smoke testing.
